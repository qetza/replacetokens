import * as rt from '../index';
import yargs from 'yargs';

enum LogLevels {
  Debug,
  Info,
  Warn,
  Error,
  Off
}

export async function run() {
  // parse arguments
  var argv = await yargs(process.argv.slice(2))
    .scriptName('replacetokens')
    .version('1.6.0')
    .usage('$0 [args]')
    .help()
    .options({
      sources: {
        type: 'string',
        array: true,
        demandOption: true,
        description: 'semi-colon separated glob patterns (fast-glob syntax) for input files'
      },
      variables: {
        type: 'string',
        array: true,
        demandOption: true,
        description: 'variables values as JSON'
      },
      'add-bom': { type: 'boolean', description: 'add BOM when writing files' },
      'case-insensitive-paths': {
        type: 'boolean',
        description: 'enable case-insensitive file path matching in glob patterns (sources and variables)'
      },
      'chars-to-escape': { type: 'string', description: 'custom characters to escape' },
      encoding: {
        default: rt.Encodings.Auto,
        description: "encoding to read and write all files (any value supported by 'iconv-lite')"
      },
      escape: {
        choices: [rt.Escapes.Off, rt.Escapes.Auto, rt.Escapes.Custom, rt.Escapes.Json, rt.Escapes.Xml],
        default: rt.Escapes.Auto,
        description: 'value escaping'
      },
      'escape-char': { type: 'string', description: 'custom escape character' },
      'log-level': {
        choice: ['debug', 'info', 'warn', 'error', 'off'],
        default: 'info',
        description: 'log level'
      },
      'missing-var-action': {
        choices: [rt.MissingVariables.Action.None, rt.MissingVariables.Action.Keep, rt.MissingVariables.Action.Replace],
        default: rt.MissingVariables.Action.None,
        description: 'action to take when variable is not found'
      },
      'missing-var-default': { type: 'string', description: 'default value when variable is not found' },
      'missing-var-log': {
        choices: [rt.MissingVariables.Log.Off, rt.MissingVariables.Log.Warn, rt.MissingVariables.Log.Error],
        default: rt.MissingVariables.Log.Warn,
        description: 'log level when variable is not found'
      },
      'no-log-color': { type: 'boolean', description: 'disable color output' },
      recursive: { type: 'boolean', description: 'enable recusive replace' },
      root: {
        type: 'string',
        description: 'root path used for relative paths in sources; use the current working directory if not specified'
      },
      separator: {
        type: 'string',
        default: rt.Defaults.Separator,
        description: 'separator used when flattening variable names'
      },
      'token-pattern': {
        choices: [
          rt.TokenPatterns.AzurePipelines,
          rt.TokenPatterns.Default,
          rt.TokenPatterns.DoubleBraces,
          rt.TokenPatterns.DoubleUnderscores,
          rt.TokenPatterns.GithubActions,
          rt.TokenPatterns.Octopus,
          rt.TokenPatterns.Custom
        ],
        default: rt.TokenPatterns.Default,
        description: 'token pattern to use'
      },
      'token-prefix': { type: 'string', description: 'custom token prefix' },
      'token-suffix': { type: 'string', description: 'custom token suffix' },
      transforms: { type: 'boolean', description: 'enable transforms on variables' },
      'transforms-prefix': {
        type: 'string',
        default: rt.Defaults.TransformPrefix,
        description: 'transform prefix'
      },
      'transforms-suffix': {
        type: 'string',
        default: rt.Defaults.TransformSuffix,
        description: 'transform suffix'
      }
    })
    .check((argv, _) => {
      if (argv['token-pattern'] === rt.TokenPatterns.Custom && (!argv['token-prefix'] || !argv['token-suffix']))
        throw new Error('token-prefix and token-suffix are mandatory with custom token-pattern');

      if (argv.escape === rt.Escapes.Custom && (!argv['escape-char'] || !argv['chars-to-escape']))
        throw new Error('escape-char and chars-to-escape are mandatory with custom escape');

      return true;
    })
    .parse();

  // override console logs
  const logLevel = (() => {
    switch (argv['log-level']) {
      case 'debug':
        return LogLevels.Debug;
      case 'info':
        return LogLevels.Info;
      case 'warn':
        return LogLevels.Warn;
      case 'error':
        return LogLevels.Error;
      default:
        return LogLevels.Off;
    }
  })();
  const logColor = argv['log-color'] ?? true;
  const _debug = console.debug;
  const _info = console.info;
  const _warn = console.warn;
  const _error = console.error;
  const _group = console.group;
  const _groupEnd = console.groupEnd;

  console.debug = function (...args) {
    if (logLevel > LogLevels.Debug) return;

    if (logColor) {
      for (let i = 0; i < args.length; ++i) {
        if (typeof args[i] === 'string') args[i] = `\x1b[90m${args[i]}\x1b[0m`;
      }
    }

    _debug.apply(null, args);
  };
  console.info = function (...args) {
    if (logLevel > LogLevels.Info) return;

    _info.apply(null, args);
  };
  console.warn = function (...args) {
    if (logLevel > LogLevels.Warn) return;

    if (logColor) {
      for (let i = 0; i < args.length; ++i) {
        if (typeof args[i] === 'string') args[i] = `\x1b[33m${args[i]}\x1b[0m`;
      }
    }

    _warn.apply(null, args);
  };
  console.error = function (...args) {
    if (logLevel > LogLevels.Error) return;

    if (logColor) {
      for (let i = 0; i < args.length; ++i) {
        if (typeof args[i] === 'string') args[i] = `\x1b[31m${args[i]}\x1b[0m`;
      }
    }

    _error.apply(null, args);
  };
  console.group = function (...args) {
    if (logLevel > LogLevels.Info) return;

    if (args.length > 0 && typeof args[0] === 'string') args[0] = `> ${args[0]}`;

    if (logColor) {
      for (let i = 0; i < args.length; ++i) {
        if (typeof args[i] === 'string') args[i] = `\x1b[36m${args[i]}\x1b[0m`;
      }
    }

    _group.apply(null, args);
  };
  console.groupEnd = function () {
    if (logLevel > LogLevels.Info) return;

    _groupEnd.apply(null);
  };

  try {
    // replace tokens
    const variables = await rt.loadVariables(argv.variables, {
      separator: argv.separator,
      normalizeWin32: false,
      root: argv.root,
      caseInsensitive: argv['case-insensitive-paths']
    });
    const result = await rt.replaceTokens(argv.sources, (name: string) => variables[name], {
      root: argv.root,
      encoding: argv.encoding,
      token: {
        pattern: argv['token-pattern'],
        prefix: argv['token-prefix'],
        suffix: argv['token-suffix']
      },
      missing: {
        action: argv['missing-var-action'],
        default:
          argv['missing-var-action'] === rt.MissingVariables.Action.Replace
            ? argv['missing-var-default'] ?? ''
            : undefined,
        log: argv['missing-var-log']
      },
      recursive: argv.recursive,
      addBOM: argv['add-bom'],
      escape: {
        type: argv.escape,
        escapeChar: argv['escape-char'],
        chars: argv['chars-to-escape']
      },
      transforms: {
        enabled: argv.transforms,
        prefix: argv['transforms-prefix'],
        suffix: argv['transforms-suffix']
      },
      sources: {
        caseInsensitive: argv['case-insensitive-paths']
      }
    });

    console.log(JSON.stringify(result));
  } finally {
    // restore console logs
    console.debug = _debug;
    console.info = _info;
    console.warn = _warn;
    console.error = _error;
    console.group = _group;
    console.groupEnd = _groupEnd;
  }
}
