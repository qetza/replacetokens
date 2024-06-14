# ReplaceTokens
[![CI](https://github.com/qetza/replacetokens/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/qetza/replacetokens/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@qetza/replacetokens.svg)](https://www.npmjs.com/package/@qetza/replacetokens) [![mit license](https://img.shields.io/badge/license-MIT-green)](https://github.com/qetza/replacetokens/blob/main/LICENSE) [![donate](https://img.shields.io/badge/donate-paypal-blue)](https://www.paypal.com/donate/?hosted_button_id=CCEAVYA8DUFD8)

Replace tokens in text files with values from the command-line, files or environment variables.

## What's new
Please refer to the [release page](https://github.com/qetza/replacetokens/releases) for the latest release notes.

## CLI
Install replace tokens as a global CLI:
```
npm install -g replacetokens
```

### Usage
```
replacetokens --sources
              [--add-bom]
              [--case-insensitive-paths]
              [--chars-to-escape]
              [--encoding]
              [--escape {auto, off, json, xml, custom}]
              [--escape-char]
              [--help]
              [--include-dot-paths]
              [--log-level {debug, info, warn, error, off}]
              [--missing-var-action {none, keep, replace, error}]
              [--missing-var-default]
              [--missing-var-log {off, warn, error}]
              [--no-log-color]
              [--recursive]
              [--root]
              [--separator]
              [--token-pattern {default, azurepipelines, doublebraces, doubleunderscores, githubactions, octopus, custom}]
              [--token-prefix]
              [--token-suffix]
              [--transform]
              [--transform-prefix]
              [--transform-suffix]
              [--use-env]
              [--variables]
              [--version]
```

#### Required parameters
`--sources <list>`

A list of files to replace tokens in.

Each entry supports:
- multiple glob patterns separated by a semi-colon (`;`) using [fast-glob](https://github.com/mrmlnc/fast-glob) syntax (you **must always** use forward slash (`/`) as a directory separator)
- outputing the result in another file adding the output path after an arrow (`=>`)
- wildcard replacement in the output file name using an asterix (`*`) in the input and output file names

If the output path is a relative path, it will be relative to the input file.

Example: `**/*.json; !local/ => out/*.json` will match all files ending with `.json` in all directories and sub directories except in `local` directory and the output will be in a sub directory `out` relative to the input file keeping the file name.

#### Optional parameters
`--add-bom`

Add BOM when writing files.

`--case-insensitive-paths`

Enable case-insensitive file path matching in glob patterns (_sources_ and _variables_).

`--chars-to-escape <string>`

The characters to escape when using `custom` escape.

`--encoding <string>`

The encoding to read and write all files. Default is `auto`.

Accepted values:
- `auto`: use [jschardet](https://github.com/aadsm/jschardet) to determine encoding
- any value supported by [iconv-lite](https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings)

`--escape <string>`

Character escape type to apply on each value. Default is `auto`.

Accepted values:
- `auto`: automatically apply JSON or XML escape based on file extension
- `off`: don't escape values
- `json`: JSON escape
- `xml`: XML escape
- `custom`: apply custom escape using _escape-char_ and _chars-to-escape_

`--escape-char <string>`

The escape character to use when using `custom` escape.

`--help`

Show help.

`--include-dot-paths`

Include directories and files starting with a dot (`.`) in glob matching results (_sources_ and _variables_).

`--log-level <string>`

The log level. Default is `info`.

Accepted values: `debug`, `info`, `warn`, `error`, `off`

`--missing-var-action <string>`

The action to take when a key is not found. Default is `none`.

Accepted values:
- `none`: replace with empty string **and** log key not found
- `keep`: leave token **and** log key not found
- `replace`: replace with _missing-var-default_
- `error`: throw error if key not found

`--missing-var-default <string>`

The default value to use when a key is not found. Default is empty string;

`--missing-var-log <string>`

The level to log the key not found message. Default is `warn`.

Accepted values: `warn`, `error`, `off`

`--no-log-color`

Disable color in logs.

`--recursive`

Enable token replacements in values recusively.

Example: `#{message}#` with variables `{ "message": "hello #{name}#!", "name": "world" }` will result in `hello world!`

`--root <string>`

The root path to use when reading files with relative paths in _sources_ or _variables_. Default is the current working directory.

`--separator <string>`

The separtor to use when flattening keys in _variables_. Default is `.`.

Example
```json
{
  "key1": {
    "key2": ["value1", "value2"],
    "key3": "value3"
  }
}
```
Will be flatten to
```json
{
  "key1.key2.0": "value1",
  "key1.key2.1": "value2",
  "key1.key3": "value3",
}
```

`--token-pattern <string>`

The token pattern to use. Default is `default`.

Accepted values:
- `azurepipelines`: $( ... )
- `custom`: _token-prefix_ ... _token-suffix_
- `default`: #{ ... }#
- `doublebraces`: {{ ... }}
- `githubactions`: ${{ ... }}
- `octopus`: #{ ... }

`--token-prefix <string>`

The token prefix when using `custom` token pattern.

`--token-suffix <string>`

The token suffix when using `custom` token pattern.

`--transforms`

Enable transforms on values. The syntax to apply transform on a value is `#{<transform>(<name>[,<parameters>])}#`

Supported transforms:
- `base64(name)`: base64 encode the value
- `indent(name[, size, firstline])`: indent lines in the value where _size_ is the indent size (default is `2`) and _firstline_ specifies if the first line must be indented also (default is `false`)
- `lower(name)`: lowercase the value
- `raw(name)`: raw value (disable escaping)
- `upper(name)`: uppercase the value

Example:
```yaml
key1: #{base64(key1)}#
key2:
#{indent(multiline, 2)}#
key3:
#{indent(multiline, 2, true)}#
key4: #{lower(key2)}#
key5: #{raw(key1)}#
key6: #{upper(key1)}#
```

With variables:
```json
{
  "key1": "value1",
  "key2": "VALUE2",
  "multiline": "- v1\n- v2"
}
```

Will result in:
```yaml
key1: dmFsdWUx
key2:
- v1
  - v2
key3:
  - v1
  - v2
key4: value2
key5: value1
key6: VALUE1
```

`--transforms-prefix <string>`

The tranforms prefix when using transforms. Default is `(`.

`--transforms-suffix <string>`

The tranforms suffix when using transforms. Default is `)`.

`--use-env`

Include environment variables as variables (names are **case-insensitive**). Parameter is **required** if `--variables` is not specified.

`--variables <list>`

A list of strings or JSON encoded key/values (keys are **case-insensitive**). Parameter is **required** if `--use-env` is not specified.

If an entry starts with:
- `@`: value is parsed as a multiple glob patterns separated by a semi-colon (';') using [fast-glob](https://github.com/mrmlnc/fast-glob) syntax to JSON or YAML files
- `$`: value is parsed as an environment variable name containing JSON encoded key/value pairs

Multiple entries are merged into a single list of key/value pairs.

Example: `'@**/*.(json|yaml);!vars.local.json' '$VARS' '{ "var1": "inline", "var2": "inline" }'` will:
- read and parse all files with `.json` or `.yaml` extension except `vars.local.json`
- read and parse the environment variable `VARS`
- parse the inline key/values `{ "var": "inline", "var2": "inline" } }`

`--version`

Show version number.

## API
Install replace tokens as a module:
```
npm install replacetokens
```

### Usage
#### loadVariables(string[] [, options])
```typescript
import * as rt from 'replacetokens';

const variables = await rt.loadVariables(
  [
    '{ "var1": "value1" }', // inline key/values
    '@**/vars.(json|yml)',  // read all vars.json and vars.yml files under root
    '$VARS'                 // parse env VARS as JSON
  ],
  {
    root: '.local'
  });
```

Load variables from the given list of strings; keys are flatten, merged are returned in uppercase.

See CLI documentation for the parsing pattern and constraints.

options:
- `caseInsensitive` _(default: false)_: enable case-insensitive matching in file paths
- `dot` _(default: false)_: include directories and files starting with a dot (`.`) in glob matching results
- `normalizeWin32` _(default: false)_: replace back-slashes (`\`) with forward-slashes (`/`) in file paths
- `root`: _(default: current working directory)_: root path used when reading files with relative paths
- `separator` _(default: .)_: the separator used when flattening the keys

#### replaceTokens(string[], (string) => string | undefined [, options])
```typescript
import * as rt from 'replacetokens';

const vars = { VAR1: "hello #{upper(var2)}#", VAR2: "world!" }; // keys must be uppercase

const result = await rt.replaceTokens(
  ['settings.json'],
  (name: string) => vars[name],
  {
    recursive: true,
    transforms: { enable: true }
  });
```

Replaces the tokens in the `sources` files using the callback `getVariable` to retrieve the values (name will **always** be in uppercase).

See CLI documentation for the input files pattern.

options:
- `addBOM` _(default: false)_: add BOM when writing files
- `encoding` _(default: auto)_: encoding to read and write all files
- `escape`: specifies how to escape values
  - `chars` _(default: null)_: the characters to escape if `type` is `custom`
  - `escapeChar` _(default: null)_: the escape character to use if `type` is `custom`
  - `type` _(default: none)_: the type of escape between: `none`, `auto`, `json`, `xml` and `custom`
- `missing`: specifies how to manage a key not found
  - `action` _(default: none)_: the action when a key is not found
  - `default` _(default: null)_: the default value
  - `log` _(default: warn)_: the key not found message log level
- `recursive` _(default: false)_: specifies if recursive replacement is enabled
- `root` _(default: current working directory)_: root path used when reading files with relative paths
- `sources`: specifies glob pattern options
  - `caseInsensitive` _(default: false)_: enable case-insensitive matching in file paths
  - `dot` _(default: false)_: include directories and files starting with a dot (`.`) in glob matching results
- `token`: specifies the token pattern
  - `pattern` _(default: default)_: the token pattern
  - `prefix` _(default: null)_: the token prefix if `pattern` is `custom`
  - `suffix` _(default: null)_: the token suffix if `pattern` is `custom`
- `transforms`: configures the transforms feature
  - `enabled` _(default: false)_: specifies if transforms are enabled
  - `prefix` _(default: ()_: the transform prefix
  - `suffix` _(default: ))_: the transform suffix
