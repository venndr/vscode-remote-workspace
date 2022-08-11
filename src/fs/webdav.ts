/**
 * This file is part of the vscode-webdav-workspace distribution.
 * Copyright (c) Marcel Joachim Kloubert.
 *
 * vscode-webdav-workspace is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * vscode-webdav-workspace is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as _ from 'lodash';
import * as Moment from 'moment';
import * as MomentTZ from 'moment-timezone';  // REQUIRED EXTENSION FOR moment MODULE!!!
import * as Path from 'path';
import * as vscode from 'vscode';
import * as vscode_helpers from 'vscode-helpers';
import * as vscrw from '../extension';
import * as vscrw_fs from '../fs';
import * as WebDAV from 'webdav-client';

interface WebDAVConnection {
    binaryEncoding: string;
    client: WebDAV.Connection;
    encoding: string;
}

interface WebDAVFileStat extends vscode.FileStat {
}

interface WebDAVReaddirComplexResult {
    creationDate: number;
    lastModified: number;
    name: string;
    size: number;
    type: 'd' | 'f';
}

const DEFAULT_BINARY_FILE_ENCODING = 'binary';
const DEFAULT_TEXT_FILE_ENCODING = 'binary';

/**
 * WebDAV file system.
 */
export class WebDAVFileSystem extends vscrw_fs.FileSystemBase {
    /**
     * @inheritdoc
     */
    public copy(source: vscode.Uri, destination: vscode.Uri, options: vscrw_fs.CopyOptions) {
        return this.forConnection(source, (conn) => {
            return new Promise<void>((resolve, reject) => {
                const COMPLETED = vscode_helpers.createCompletedAction(resolve, reject);

                try {
                    conn.client.copy(
                        toWebDAVPath(source.path),
                        toWebDAVPath(destination.path),
                        options.overwrite,
                        (err) => {
                            COMPLETED(err);
                        }
                    );
                } catch (e) {
                    COMPLETED(e);
                }
            });
        });
    }

    /**
     * @inheritdoc
     */
    public async createDirectory(uri: vscode.Uri) {
        return this.forConnection(uri, (conn) => {
            return new Promise<void>((resolve, reject) => {
                const COMPLETED = vscode_helpers.createCompletedAction(resolve, reject);

                try {
                    conn.client.mkdir(
                        toWebDAVPath(uri.path),
                        (err) => {
                            COMPLETED(err);
                        }
                    );
                } catch (e) {
                    COMPLETED(e);
                }
            });
        });
    }

    /**
     * @inheritdoc
     */
    public async delete(uri: vscode.Uri, options: { recursive: boolean }) {
        return this.forConnection(uri, (conn) => {
            return new Promise<void>((resolve, reject) => {
                const COMPLETED = vscode_helpers.createCompletedAction(resolve, reject);

                try {
                    conn.client.delete(
                        toWebDAVPath(uri.path),
                        (err) => {
                            COMPLETED(err);
                        }
                    );
                } catch (e) {
                    COMPLETED(e);
                }
            });
        });
    }

    private async forConnection<TResult = any>(
        uri: vscode.Uri, action: (conn: WebDAVConnection) => TResult | PromiseLike<TResult>
    ): Promise<TResult> {
        try {
            const CONN = await this.openConnection(uri);

            if (action) {
                return await Promise.resolve(
                    action( CONN )
                );
            }
        } catch (e) {
            this.logger
                .trace(e, 'fs.webdav.WebDAVFileSystem.forConnection()');

            throw e;
        }
    }

    private getDetails(uri: vscode.Uri) {
        return this.forConnection(uri, (conn) => {
            return new Promise<WebDAVReaddirComplexResult>((resolve, reject) => {
                const COMPLETED = vscode_helpers.createCompletedAction(resolve, reject);

                try {
                    conn.client.getProperties(
                        toWebDAVPath( uri.path ),
                        (err: any, properties: any) => {
                            if (err) {
                                COMPLETED(err);
                                return;
                            }

                            try {
                                const NEW_RESULT: WebDAVReaddirComplexResult = {
                                    creationDate: undefined,
                                    lastModified: undefined,
                                    name: Path.basename(uri.path),
                                    size: undefined,
                                    type: 'f',
                                };

                                let creationdate: Moment.Moment;
                                let lastmodified: Moment.Moment;

                                if (properties) {
                                    for (const P in properties) {
                                        try {
                                            const PROP = properties[P];
                                            if (_.isNil(PROP)) {
                                                continue;
                                            }

                                            switch (vscode_helpers.normalizeString(P)) {
                                                case 'dav:creationdate':
                                                    if (!vscode_helpers.isEmptyString(PROP.content)) {
                                                        creationdate = Moment(
                                                            vscode_helpers.toStringSafe(PROP.content).trim()
                                                        );
                                                    }
                                                    break;

                                                case 'dav:getlastmodified':
                                                    if (!vscode_helpers.isEmptyString(PROP.content)) {
                                                        lastmodified = Moment(
                                                            vscode_helpers.toStringSafe(PROP.content).trim()
                                                        );
                                                    }
                                                    break;

                                                case 'dav:getcontentlength':
                                                    if (!vscode_helpers.isEmptyString(PROP.content)) {
                                                        NEW_RESULT.size = parseInt(
                                                            vscode_helpers.toStringSafe(PROP.content).trim()
                                                        );
                                                    }
                                                    break;

                                                case 'dav:resourcetype':
                                                    {
                                                        const IS_DIR = vscode_helpers.from(
                                                            vscode_helpers.asArray(PROP.content)
                                                        ).any(c => {
                                                            return 'dav:collection' ===
                                                                    vscode_helpers.normalizeString(c.name);
                                                        });

                                                        if (IS_DIR) {
                                                            NEW_RESULT.type = 'd';
                                                        }
                                                    }
                                                    break;
                                            }
                                        } catch { }
                                    }
                                }

                                if (creationdate && creationdate.isValid()) {
                                    NEW_RESULT.creationDate = vscode_helpers.asUTC( creationdate ).unix();
                                }
                                if (lastmodified && lastmodified.isValid()) {
                                    NEW_RESULT.lastModified = vscode_helpers.asUTC( lastmodified ).unix();
                                }

                                if (isNaN(NEW_RESULT.creationDate)) {
                                    NEW_RESULT.creationDate = 0;
                                }
                                if (isNaN(NEW_RESULT.lastModified)) {
                                    NEW_RESULT.lastModified = 0;
                                }
                                if (isNaN(NEW_RESULT.size)) {
                                    NEW_RESULT.size = 0;
                                }

                                COMPLETED(null, NEW_RESULT);
                            } catch (e) {
                                COMPLETED(e);
                            }
                        }
                    );
                } catch (e) {
                    COMPLETED(e);
                }
            });
        });
    }

    private getEncoding(
        data: Buffer,
        textEnc: string, binEnc: string,
    ) {
        let enc: string;

        try {
            enc = vscode_helpers.isBinaryContentSync(data) ? binEnc : textEnc;
        } catch (e) {
            this.logger
                .warn(e, 'fs.WebDAVFileSystem.getEncoding()');
        }

        if (vscode_helpers.isEmptyString(enc)) {
            enc = DEFAULT_TEXT_FILE_ENCODING;
        }

        return enc;
    }

    private list(uri: vscode.Uri) {
        return this.forConnection(uri, async (conn) => {
            const WF = vscode_helpers.buildWorkflow();

            return WF.next(() => {
                return new Promise<WebDAV.ConnectionReaddirComplexResult[]>((resolve, reject) => {
                    const COMPLETED = vscode_helpers.createCompletedAction(resolve, reject);

                    try {
                        conn.client.readdir(
                            toWebDAVPath(uri.path),
                            {
                                extraProperties: [],
                                properties: true,
                            },
                            (err: any, files: WebDAV.ConnectionReaddirComplexResult[]) => {
                                if (err) {
                                    COMPLETED(err);
                                } else {
                                    files.shift();
                                    COMPLETED(null, files);
                                }
                            }
                        );
                    } catch (e) {
                        COMPLETED(e);
                    }
                });
            }).next((files) => {
                return new Promise<WebDAVReaddirComplexResult[]>(async (resolve, reject) => {
                    const ALL_RESULTS: WebDAVReaddirComplexResult[] = [];
                    const COMPLETED = (err: any) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve( vscode_helpers.from(ALL_RESULTS).orderBy(r => {
                                return 'd' === r.type ? 0 : 1;
                            }).thenBy(r => {
                                return vscode_helpers.normalizeString(r.name);
                            }).toArray() );
                        }
                    };

                    try {
                        const GET_NEXT_PROPERTIES = async () => {
                            if (files.length < 1) {
                                COMPLETED(null);
                                return;
                            }

                            const F = files.shift();

                            try {
                                const creationDate = Moment(
                                    F.creationDate
                                ).unix();
                                const lastModified = Moment(
                                    F.lastModified
                                ).unix()
                                const w = {
                                    creationDate: isNaN(creationDate) ? 0 : creationDate,
                                    lastModified: isNaN(lastModified) ? 0 : lastModified,
                                    name: F.name,
                                    size: isNaN(F.size) ? 0 : F.size,
                                    type: (F.type === "directory" ? 'd' : 'f') as WebDAVReaddirComplexResult["type"],
                                }
                                if(w.name !== "") {
                                    ALL_RESULTS.push(w);
                                }
                            } catch { }

                            await GET_NEXT_PROPERTIES();
                        };

                        await GET_NEXT_PROPERTIES();
                    } catch (e) {
                        COMPLETED(e);
                    }
                });
            }).start();
        });
    }

    private async openConnection(uri: vscode.Uri): Promise<WebDAVConnection> {
        // format:
        //
        // webdav://[user:password@]host[:port][/path/to/file/or/folder]

        const PARAMS = vscrw.getUriParams(uri);

        let base = vscrw.normalizePath(
            vscode_helpers.toStringSafe(PARAMS['base'])
        );
        let ssl = vscrw.isTrue(PARAMS['ssl']);

        let enc = vscode_helpers.normalizeString(
            PARAMS['encoding']
        );
        if ('' === enc) {
            enc = DEFAULT_TEXT_FILE_ENCODING;
        }

        let binEnc = vscode_helpers.normalizeString(
            PARAMS['binencoding']
        );
        if ('' === binEnc) {
            binEnc = DEFAULT_BINARY_FILE_ENCODING;
        }

        const HOST_AND_CRED = await vscrw.extractHostAndCredentials(uri,
                                                                    ssl ? 443 : 80);

        let authenticator: WebDAV.Authenticator;
        const AUTH_TYPE = vscode_helpers.normalizeString(PARAMS['authtype']);

        switch (AUTH_TYPE) {
            case '':
            case 'b':
            case 'basic':
                authenticator = new WebDAV.BasicAuthenticator();
                break;

            case 'd':
            case 'digest':
                authenticator = new WebDAV.DigestAuthenticator();
                break;

            default:
                throw new Error(`Authentication type '${ AUTH_TYPE }' is not supported!`);
        }

        const CONN_OPTS: WebDAV.ConnectionOptions = {
            authenticator: authenticator,
            password: PARAMS['password'] || HOST_AND_CRED.password,
            username: PARAMS['username'] || HOST_AND_CRED.user,
            url: `http${ ssl ? 's' : '' }://${ HOST_AND_CRED.host }:${ HOST_AND_CRED.port }${ base }`,
        };

        return {
            client: new WebDAV.Connection(CONN_OPTS),
            binaryEncoding: binEnc,
            encoding: enc,
        };
    }

    /**
     * @inheritdoc
     */
    public async readDirectory(uri: vscode.Uri): Promise<vscrw_fs.DirectoryEntry[]> {
        try {
            const ENTRIES: vscrw_fs.DirectoryEntry[] = [];

            const LIST = await this.list(uri);
            for (const ITEM of LIST) {
                ENTRIES.push([
                    ITEM.name,
                    'd' === ITEM.type ? vscode.FileType.Directory
                                      : vscode.FileType.File
                ]);
            }

            return ENTRIES;
        } catch (e) {
            vscode.FileSystemError.FileNotFound( uri );
        }
    }

    /**
     * @inheritdoc
     */
    public readFile(uri: vscode.Uri): Promise<Uint8Array> {
        return this.forConnection(uri, (conn) => {
            return new Promise<Uint8Array>(async (resolve, reject) => {
                const COMPLETED = vscode_helpers.createCompletedAction(resolve, reject);

                try {
                    conn.client.get(
                        toWebDAVPath(uri.path),
                        (err: any, body: string) => {
                            if (err) {
                                COMPLETED(err);
                            } else {
                                try {
                                    const ENC = this.getEncoding(new Buffer(body, DEFAULT_TEXT_FILE_ENCODING),
                                                                 conn.encoding, conn.binaryEncoding);

                                    COMPLETED(null,
                                              // @ts-ignore
                                              new Buffer(vscode_helpers.toStringSafe(body), ENC));
                                } catch (e) {
                                    COMPLETED(e);
                                }
                            }
                        }
                    );
                } catch (e) {
                    COMPLETED(e);
                }
            });
        });
    }

    /**
     * Register file system to extension.
     *
     * @param {vscode.ExtensionContext} context The extension context.
     *
     * @return {WebDAVFileSystem} The registrated provider instance.
     */
    public static register(context: vscode.ExtensionContext) {
        const NEW_FS = new WebDAVFileSystem();

        try {
            context.subscriptions.push(
                vscode.workspace.registerFileSystemProvider(WebDAVFileSystem.scheme,
                                                            NEW_FS,
                                                            { isCaseSensitive: true })
            );
        } catch (e) {
            vscode_helpers.tryDispose( NEW_FS );

            throw e;
        }

        return NEW_FS;
    }

    /**
     * @inheritdoc
     */
    public rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }) {
        return this.forConnection(oldUri, (conn) => {
            return new Promise<void>((resolve, reject) => {
                const COMPLETED = vscode_helpers.createCompletedAction(resolve, reject);

                try {
                    conn.client.move(
                        toWebDAVPath(oldUri.path),
                        toWebDAVPath(newUri.path),
                        options.overwrite,
                        (err) => {
                            COMPLETED(err);
                        }
                    );
                } catch (e) {
                    COMPLETED(e);
                }
            });
        });
    }

    /**
     * Stores the name of the scheme.
     */
    public static readonly scheme = 'webdav';

    /**
     * @inheritdoc
     */
    public async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return this.statInner( uri );
    }

    private async statInner(uri: vscode.Uri): Promise<WebDAVFileStat> {
        if ('/' === vscrw.normalizePath(uri.path)) {
            return {
                type: vscode.FileType.Directory,
                ctime: 0,
                mtime: 0,
                size: 0,
            };
        }

        const DETAILS = await this.getDetails(uri);

        return {
            ctime: DETAILS.creationDate,
            mtime: DETAILS.lastModified,
            size: DETAILS.size,
            type: 'd' === DETAILS.type ? vscode.FileType.Directory
                                       : vscode.FileType.File,
        };
    }

    private async tryGetStat(uri: vscode.Uri): Promise<WebDAVFileStat | false> {
        let stat: WebDAVFileStat | false;
        try {
            stat = await this.statInner( uri );
        } catch {
            stat = false;
        }

        return stat;
    }

    /**
     * @inheritdoc
     */
    public watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
        // TODO: implement
        return {
            dispose: () => {

            }
        };
    }

    /**
     * @inheritdoc
     */
    public writeFile(uri: vscode.Uri, content: Uint8Array, options: vscrw_fs.WriteFileOptions) {
        return this.forConnection(uri, (conn) => {
            return new Promise<void>(async (resolve, reject) => {
                const COMPLETED = vscode_helpers.createCompletedAction(resolve, reject);

                try {
                    this.throwIfWriteFileIsNotAllowed(
                        await this.tryGetStat(uri), options,
                        uri
                    );

                    const DATA_TO_WRITE = vscrw.asBuffer(content);
                    const ENC = this.getEncoding(DATA_TO_WRITE,
                                                 conn.encoding, conn.binaryEncoding);

                    conn.client.put(
                        toWebDAVPath(uri.path),
                        DATA_TO_WRITE.toString( ENC ),
                        (err: any) => {
                            COMPLETED(err);
                        }
                    );
                } catch (e) {
                    COMPLETED(e);
                }
            });
        });
    }
}

function toWebDAVPath(p: string) {
    return encodeURI( vscrw.normalizePath(p) );
}

function uriWithNewPath(uri: vscode.Uri, newPath: string): vscode.Uri {
    if (uri) {
        return vscode.Uri.parse(`webdav://${ uri.authority }${ vscrw.normalizePath(newPath) }${ vscode_helpers.isEmptyString(uri.query) ? '' : ('?' + uri.query) }`);
    }
}
