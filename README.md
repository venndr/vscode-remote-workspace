# vscode-webdav-workspace

This package is a fork of mkloubert.vscode-webdav-workspace with only webdav capabilities - however, improved.

Original author Marcel Joachim Kloubert.

## Table of contents

1. [Install](#install-)
2. [How to use](#how-to-use-)
   * [About parameters](#about-parameters-)
     * [Import parameters](#import-parameters-)
     * [Placeholders](#placeholders-)
       * [Environment variables](#environment-variables-)
       * [Static](#static-)
   * [WebDAV](#webdav-)
     * [Parameters](#parameters--7)
       * [authType](#authtype-)
3. [Commands](#commands-)
4. [Logs](#logs-)
5. [Support and contribute](#support-and-contribute-)
   * [Contributors](#contributors-)
6. [Related projects](#related-projects-)
   * [node-simple-socket](#node-simple-socket-)
   * [vscode-helpers](#vscode-helpers-)

## Install [[&uarr;](#table-of-contents)]

Launch VS Code Quick Open (`Ctrl + P`), paste the following command, and press enter:

```bash
ext install vscode-webdav-workspace
```

Or search for things like `vscode-webdav-workspace` in your editor.

## How to use [[&uarr;](#table-of-contents)]

Create (or update) a `.code-workspace` file and open it by using `File >> Open Workspace...` in the GUI:

```json
{
    "folders": [{
        "uri": "webdav://my-user:my-password@example.com?debug=1",
        "name": "My SFTP folder"
    }]
}
```

If you've never created a `.code-workspace` file, you might start with a new folder in your home directory, for instance you could name it "VSCodeWorkspace" or "MyApp". Copy the example configuration (shown above) into a new file, and make sure you edit the URI to be specific to your desired protocol and path. Save the file, ensuring the file name ends with `.code-workspace`. Then, in the VS Code GUI, open that file using `File >> Open Workspace...`; after a few moments you'll be connected to the URI you specified.

### About parameters [[&uarr;](#how-to-use-)]

A parameter is a key-value-pair, which has to be setup in the URI and NOT in the `settings` section of a `.code-workspace` file.

If you want to set the `ssl` parameter to `true` for a [WebDav connection](#webdav-), e.g.:

```json
{
    "folders": [{
        "uri": "webdav://myUser:myPass@example.com?ssl=true",
        "name": "My webdav folder"
    }]
}
```

#### Import parameters [[&uarr;](#import-parameters-)]

Any URI / protocol supports a general parameter, called `params`, which can load / import parameters from an external file, that contains a JSON object.

For example, you can create a file, lets say `webdav_server1_uri_params.json`, inside your home directory with the following content:

```json
{
    "username": "a",
    "password": "b"
}
```

In the URI, inside your `.code-workspace` file, you have to define the `params` parameter and set it to the path / name of that JSON file:

```json
{
    "folders": [{
        "uri": "webdav://example.com?params=webdav_server1_uri_params.json",
        "name": "My WebDav folder"
    }]
}
```

Relative paths will be mapped to the user's home directory.

Explicit URI parameters, which are also defined in such an external file, will be overwritten by the values of the file.

Note that this file can provide username and password for webdav.

#### Placeholders [[&uarr;](#about-parameters-)]

An URI parameter can store placeholders, which are replaced by the values of an external file.

For example, you can create a file, like `my_values.json`, inside your home directory with the following content:

```json
{
    "importEnvVars": true,
    "exclude": [
        "fooParam"
    ],
    "values": {
        "ENC": {
            "code": " ('UTF' + '8').toLowerCase() ",
            "type": "code"
        },
        "FOO": "bar",
        "SSL": {
            "value": 1
        }
    }
}
```

You can now place them into the values of parameters, by using the format `${VAR_NAME}`:

```json
{
    "folders": [{
        "uri": "webdav://myUser:myPassword@webdav.example.com/?values=my_values.json&ssl=${SSL}&encoding=${ENC}&binEncoding=${ENC}&fooParam=${FOO}",
        "name": "My WebDAV folder"
    }]
}
```

If `importEnvVars` is set to `(true)`, all [environment variables of the current process](https://nodejs.org/api/process.html#process_process_env) will be imported automatically. The default value is `(false)`.

Parameters, where placeholders DO NOT work:

* `params`
* `values`

##### Environment variables [[&uarr;](#placeholders-)]

```json
{
    "values": {
        "FOO": {
            "name": "SSH_AUTH_SOCK",
            "type": "env"
        }
    }
}
```

##### Static [[&uarr;](#placeholders-)]

```json
{
    "values": {
        "foo1": "bar1",
        "Foo2": {
            "value": 2
        }
    }
}
```

### WebDAV [[&uarr;](#how-to-use-)]

URL Format: `webdav://[user:password@]host[:port][/path/to/file/or/folder][?param1=value1&param2=value2]`

```json
{
    "folders": [{
        "uri": "webdav://myUser:myPassword@webdav.example.com/?ssl=1",
        "name": "My WebDAV server"
    }]
}
```

#### Parameters [[&uarr;](#webdav-)]

| Name | Description | Example |
| ---- | --------- | --------- |
| `auth` | A path to a file, that contains the part left to `@` (the credentials). Relative paths will be mapped to the user's home directory. | `auth=webdav_server1` |
| `base` | The base path, that is used as prefix for all requests. | `base=nextcloud/remote.php/webdav/` |
| `binEncoding` | The [encoding](https://nodejs.org/api/buffer.html#buffer_buf_tostring_encoding_start_end) for reading and writing binary files to use. Default: `binary` | `binEncoding=utf8` |
| `encoding` | The [encoding](https://nodejs.org/api/buffer.html#buffer_buf_tostring_encoding_start_end) for reading and writing text files to use. Default: `binary` | `encoding=utf8` |
| `authType` | Kind of authentication to use if at least a username and/or password is defined (s. [authType](#authtype-). Default: `basic` | `authType=digest` |
| `params` | The name of an external file, which contains other parameters for the URI. s. [Import parameters](#import-parameters-) | `params=webdav_uri_params.json` |
| `ssl` | Use secure HTTP or not. Can be `0` or `1`. Default: `0` | `ssl=1` |
| `values` | The name of an external file, which contains [placeholders](#placeholders-) | `values=my_values.json` |

#### authType [[&uarr;](#parameters--7)]

Defines, what type of authentication should be used, if at least a username and/or password is defined. Possible values are:

| Name | Alternatives | Description |
| ---- | ------------ | ----------- |
| `basic` | `b` | [Basic access authentication](https://en.wikipedia.org/wiki/Basic_access_authentication) |
| `digest` | `d` | [Digest access authentication](https://en.wikipedia.org/wiki/Digest_access_authentication) |

## Commands [[&uarr;](#table-of-contents)]

Press `F1` and enter one of the following commands:

| Name | Description | ID |
| ---- | ----------- | -- |
| `Remote Workspace: Open URI ...` | Adds / opens a new workspace folder with a [supported URI](#how-to-use-). | `extension.remote.workspace.openURI` |
| `Remote Workspace: Receive Remote URI ...` | Receives a remote URI from another editor. | `extension.remote.workspace.receiveWorkspaceURI` |
| `Remote Workspace: Share Remote URI ...` | Shares a remote URI with another editor. | `extension.remote.workspace.sendWorkspaceURI` |

If you want to define shortcuts for one or more command(s), have a look at the article [Key Bindings for Visual Studio Code](https://code.visualstudio.com/docs/getstarted/keybindings).

## Logs [[&uarr;](#table-of-contents)]

Log files are stored inside the `.vscode-webdav-workspace/.logs` subfolder of the user's home directory, separated by day.
