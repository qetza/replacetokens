# Changelog

## v1.6.0
- Add support for case-insensitive glob pattern matching ([#13](https://github.com/qetza/replacetokens/issues/13)).
- Add support for dot paths in glob pattern matching ([#12](https://github.com/qetza/replacetokens/issues/12)).
- Remove `readTextFile` function.

## v1.5.0
- Externalize variable retrieval through callback to support more usage scenarios like external name normalization.
- Rename `parseVariables` to `loadVariables` and add logs.

## v1.4.0
- Add support for glob pattern in variable file paths ([#4](https://github.com/qetza/replacetokens/issues/4)).
- Add support for YAML variable files ([#5](https://github.com/qetza/replacetokens/issues/5)).
- Add support for JSON with comments in variables ([#6](https://github.com/qetza/replacetokens/issues/6)).
- Add `parseVariables` function to parse string variables (load, flatten & merge).
- Remove `flattenAndMerge` function (use `parseVariables` instead).

## v1.3.0
- Make variable names case-insensitive.

## v1.2.0
- Replace `merge` with `flattenAndMerge` to flatten objects and merge.

## v1.1.0
- Add `merge` function to merge deep merge objects.
- Add `readTextFile` function to read text files with encoding.
- Add `replaceTokens` function to replace tokens in files.
- Add CLI.