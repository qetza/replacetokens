import * as fs from 'fs/promises';
import * as iconv from 'iconv-lite';
import * as jschardet from 'jschardet';
import * as path from 'path';
import * as os from 'os';
import * as fg from 'fast-glob';
import * as yaml from 'js-yaml';

export class Encodings {
  static readonly Auto: string = 'auto';
}

export class TokenPatterns {
  static readonly Default: string = 'default';
  static readonly AzurePipelines: string = 'azpipelines';
  static readonly Custom: string = 'custom';
  static readonly DoubleBraces: string = 'doublebraces';
  static readonly DoubleUnderscores: string = 'doubleunderscores';
  static readonly GithubActions: string = 'githubactions';
  static readonly Octopus: string = 'octopus';
}

export class MissingVariables {
  static Log = class {
    static readonly Off: string = 'off';
    static readonly Warn: string = 'warn';
    static readonly Error: string = 'error';
  };
  static Action = class {
    static readonly None: string = 'none';
    static readonly Keep: string = 'keep';
    static readonly Replace: string = 'replace';
  };
}

export class Escapes {
  static readonly Auto: string = 'auto';
  static readonly Custom: string = 'custom';
  static readonly Json: string = 'json';
  static readonly Off: string = 'off';
  static readonly Xml: string = 'xml';
}

export class Defaults {
  static readonly Separator: string = '.';
  static readonly TransformPrefix: string = '(';
  static readonly TransformSuffix: string = ')';
}

export interface Options {
  readonly encoding?: string;
  readonly root?: string;
  readonly token?: { readonly pattern?: string; readonly prefix?: string; readonly suffix?: string };
  readonly missing?: { readonly log?: string; readonly action?: string; readonly default?: string };
  readonly recursive?: boolean;
  readonly addBOM?: boolean;
  readonly escape?: { readonly type?: string; readonly chars?: string; readonly escapeChar?: string };
  readonly separator?: string;
  readonly transforms?: { readonly enabled?: boolean; readonly prefix?: string; readonly suffix?: string };
}

export class Counter {
  tokens: number = 0;
  replaced: number = 0;
  files: number = 0;
  defaults: number = 0;
  transforms: number = 0;
}

export interface ParseVariablesOptions {
  separator?: string;
  normalizeWin32?: boolean;
  root?: string;
  dot?: boolean;
}
export async function parseVariables(
  variables: string[],
  options?: ParseVariablesOptions
): Promise<{ [key: string]: string }> {
  variables = variables || ['{}'];

  // load all inputs
  let load = async (v: string): Promise<any[]> => {
    if (v[0] === '@') {
      // load from file
      return await loadVariablesFromFile(v.substring(1), options);
    } else if (v[0] === '$') {
      // load from environment variable
      console.debug(`loading variables from env '${v.substring(1)}'`);

      return [JSON.parse(process.env[v.substring(1)] || '{}')];
    }

    // return given variables
    return [JSON.parse(v)];
  };

  // merge inputs
  const vars: any[] = [];
  for (const v of variables) {
    vars.push(...(await load(v)));
  }

  return flattenAndMerge(options?.separator || Defaults.Separator, ...vars);
}

async function loadVariablesFromFile(name: string, options?: ParseVariablesOptions): Promise<any[]> {
  if (os.platform() === 'win32' && options?.normalizeWin32) {
    name = name.replace(/\\/g, '/');
  }

  const files = await fg.glob(
    name.split(';').map(v => v.trim()),
    {
      absolute: true,
      cwd: options?.root,
      dot: options?.dot,
      onlyFiles: true,
      unique: true
    }
  );

  const vars: any[] = [];
  for (const file of files) {
    console.debug(`loading variables from file '${normalizePath(file)}'`);

    const extension = path.extname(file).toLowerCase();
    const content = (await readTextFile(file)).content;

    if (['.yml', '.yaml'].includes(extension)) {
      yaml.loadAll(content, (v: any) => {
        vars.push(v);
      });
    } else {
      vars.push(JSON.parse(content));
    }
  }

  return vars;
}

function flattenAndMerge(separator: string, ...objects: any[]): { [key: string]: string } {
  return objects.reduce<{ [key: string]: string }>((result, current) => {
    const values = {};
    for (const [key, value] of Object.entries(flatten(current, separator))) {
      values[key] = value.value;
    }

    return { ...result, ...values };
  }, {});
}
function flatten(
  object: Object,
  separator: string,
  parentKey?: string
): { [key: string]: { name: string; value: string } } {
  let result = {};

  for (const [key, value] of Object.entries(object)) {
    let flattenKey = parentKey ? `${parentKey}${separator}${key}` : key;

    if (value && typeof value === 'object') result = { ...result, ...flatten(value, separator, flattenKey) };
    else result[flattenKey.toUpperCase()] = { name: flattenKey, value: value?.toString() ?? '' };
  }

  return result;
}

export async function readTextFile(
  path: string,
  encoding: string = Encodings.Auto
): Promise<{ encoding: string; content: string }> {
  encoding = encoding ?? Encodings.Auto;

  // read raw content
  const data: Buffer = await fs.readFile(path, { flag: 'r' });

  if (encoding === Encodings.Auto) {
    encoding = (() => {
      switch (jschardet.detect(data).encoding) {
        case 'UTF-8':
          return 'utf-8';
        case 'UTF-16LE':
          return 'utf-16le';
        case 'UTF-16BE':
          return 'utf-16be';
        case 'windows-1252':
          return 'windows1252';
        default:
          return 'ascii';
      }
    })();
  }

  // decode content
  return { encoding: encoding, content: iconv.decode(data, encoding) };
}

export async function replaceTokens(
  sources: readonly string[] | string,
  variables: { [key: string]: any },
  options?: Options
): Promise<Counter> {
  // set defaults
  sources = typeof sources === 'string' ? [sources] : sources;
  options = {
    addBOM: options?.addBOM ?? true,
    encoding: options?.encoding ?? Encodings.Auto,
    root: options?.root ?? process.cwd(),
    escape: {
      chars: options?.escape?.chars,
      escapeChar: options?.escape?.escapeChar,
      type: options?.escape?.type ?? Escapes.Off
    },
    missing: {
      action: options?.missing?.action ?? MissingVariables.Action.None,
      default: options?.missing?.default,
      log: options?.missing?.log ?? MissingVariables.Log.Warn
    },
    recursive: options?.recursive ?? false,
    separator: options?.separator ?? Defaults.Separator,
    token: {
      pattern: options?.token?.pattern ?? TokenPatterns.Default,
      prefix: (() => {
        switch (options?.token?.pattern ?? TokenPatterns.Default) {
          case TokenPatterns.Default:
            return '#{';
          case TokenPatterns.AzurePipelines:
            return '$(';
          case TokenPatterns.DoubleBraces:
            return '{{';
          case TokenPatterns.DoubleUnderscores:
            return '__';
          case TokenPatterns.GithubActions:
            return '${{';
          case TokenPatterns.Octopus:
            return '#{';
        }

        return options?.token?.prefix;
      })(),
      suffix: (() => {
        switch (options?.token?.pattern ?? TokenPatterns.Default) {
          case TokenPatterns.Default:
            return '}#';
          case TokenPatterns.AzurePipelines:
            return ')';
          case TokenPatterns.DoubleBraces:
            return '}}';
          case TokenPatterns.DoubleUnderscores:
            return '__';
          case TokenPatterns.GithubActions:
            return '}}';
          case TokenPatterns.Octopus:
            return '}';
        }

        return options?.token?.suffix;
      })()
    },
    transforms: {
      enabled: options?.transforms?.enabled ?? false,
      prefix: options?.transforms?.prefix ?? Defaults.TransformPrefix,
      suffix: options?.transforms?.suffix ?? Defaults.TransformSuffix
    }
  };

  // validate options
  if (options.token!.pattern === TokenPatterns.Custom && (!options.token!.prefix || !options.token!.suffix))
    throw new Error('token prefix and token suffix are mandatory with custom token pattern');

  if (options.escape!.type === Escapes.Custom && (!options.escape!.chars || !options.escape!.escapeChar))
    throw new Error('chars to escape and escape char are mandatory with custom escape');

  if (options.transforms!.enabled && options.token!.suffix === options.transforms!.suffix)
    throw new Error('token and transform suffixes cannot be the same');

  // initialize
  const counters = new Counter();
  const vars = loadVariables(variables, options);
  const patterns = parseSources(sources);
  const tokenRegex = generateTokenRegex(options.token!.prefix!, options.token!.suffix!);
  const transformRegex = generateTransformRegex(options.transforms!.prefix!, options.transforms!.suffix!);
  const customEscapeRegex =
    options.escape!.type === Escapes.Custom ? generateCustomEscapeRegex(options.escape!.chars!) : undefined;

  // replace tokens
  for (const pattern of patterns) {
    var inputs = await fg.glob(pattern.inputPatterns, {
      absolute: true,
      cwd: options.root,
      onlyFiles: true,
      unique: true
    });

    for (const input of inputs) {
      // compute output
      let output = input;
      if (pattern.outputPattern) {
        output = pattern.outputPattern;

        if (pattern.inputHasWildcard) {
          const patternBasename = path.basename(pattern.inputPatterns[0]);
          const inputBasename = path.basename(input);
          const index = patternBasename.indexOf('*');
          const value = inputBasename.substring(index, inputBasename.length - (patternBasename.length - index - 1));

          output = output.replace('*', value);
        }

        if (pattern.isOutputRelative) output = path.join(path.dirname(input), output);
      }

      // replace tokens in file
      let c = await replaceTokensInFile(
        normalizePath(input),
        normalizePath(output),
        vars,
        tokenRegex,
        transformRegex,
        customEscapeRegex,
        options
      );
      counters.defaults += c.defaults;
      counters.replaced += c.replaced;
      counters.tokens += c.tokens;
      counters.transforms += c.transforms;

      ++counters.files;
    }
  }

  return counters;
}

function loadVariables(variables: { [key: string]: any }, options: Options): { [key: string]: string } {
  console.group('loading variables');

  try {
    // flatten with uppercase and stringify json variables
    const data = flatten(variables ?? {}, options.separator!);

    // get variables with case-insensitive key and value
    const vars = {};
    for (const [key, value] of Object.entries(data)) {
      vars[key] = value.value;

      console.debug(`loaded '${value.name}'`);
    }

    const count = Object.keys(vars).length;
    console.info(`${count} variable${count > 1 ? 's' : ''} loaded`);

    return vars;
  } finally {
    console.groupEnd();
  }
}

interface InputPattern {
  inputHasWildcard: boolean;
  inputPatterns: string[];
  isOutputRelative: boolean;
  outputPattern?: string;
}

function parseSources(sources: readonly string[]): readonly InputPattern[] {
  sources = sources ?? [];
  let patterns: InputPattern[] = [];

  sources.forEach(source => {
    const parts = source.split('=>');
    const pattern: InputPattern = {
      inputHasWildcard: false,
      inputPatterns: parts[0].trim().split(';'),
      isOutputRelative: false,
      outputPattern: undefined
    };

    pattern.inputHasWildcard = path.basename(pattern.inputPatterns[0]).indexOf('*') != -1; // check wildcard on filename

    if (parts.length > 1) {
      // source has output
      pattern.outputPattern = normalizePath(parts[1].trim());
      pattern.isOutputRelative = !path.isAbsolute(pattern.outputPattern);
    }

    patterns.push(pattern);
  });

  return patterns;
}

function normalizePath(path: string): string {
  path = path ?? '';

  if (os.platform() === 'win32') {
    // convert to windows
    path = path.replace(/\//g, '\\');

    // remove redundant backslash except for UNC
    let isUnc = /^\\\\+[^\\]/.test(path);
    return (isUnc ? '\\' : '') + path.replace(/\\\\+/g, '\\');
  }

  // remove redundant slash
  return path.replace(/\/\/+/g, '/');
}

const REGEX_ESCAPE_RE = /[-\/\\^$*+?.()|[\]{}]/g;
function generateTokenRegex(prefix: string, suffix: string): RegExp {
  const escapedPrefix = prefix.replace(REGEX_ESCAPE_RE, '\\$&');
  const escapedSuffix = suffix.replace(REGEX_ESCAPE_RE, '\\$&');
  const regex = new RegExp(
    `${escapedPrefix}\\s*((?:(?!${escapedPrefix})(?!\\s*${escapedSuffix}).)*)\\s*${escapedSuffix}`,
    'gm'
  );

  console.debug(`token pattern '${regex.source}'`);

  return regex;
}

function generateTransformRegex(prefix: string, suffix: string): RegExp {
  const escapedPrefix: string = prefix.replace(REGEX_ESCAPE_RE, '\\$&');
  const escapedSuffix: string = suffix.replace(REGEX_ESCAPE_RE, '\\$&');
  const regex = new RegExp(
    `\\s*(.*)${escapedPrefix}\\s*((?:(?!${escapedPrefix})(?!\\s*${escapedSuffix}).)*)\\s*${escapedSuffix}\\s*`
  );

  console.debug(`transform pattern '${regex.source}'`);

  return regex;
}

function generateCustomEscapeRegex(chars: string): RegExp {
  const escapedChars: string = chars.replace(REGEX_ESCAPE_RE, '\\$&');
  const regex: RegExp = RegExp(`([${escapedChars}])`, 'gm');

  console.debug(`custom espace '${regex.source}'`);

  return regex;
}

async function replaceTokensInFile(
  input: string,
  output: string,
  variables: { [key: string]: string },
  tokenRegex: RegExp,
  transformRegex: RegExp,
  customEscapeRegex: RegExp | undefined,
  options: Options
): Promise<Counter> {
  console.group(`replacing tokens in '${input}'`);

  try {
    const counters = new Counter();
    counters.files = 1;

    if (input !== output) console.info(`output '${output}'`);

    // read input
    let file = await readTextFile(input, options.encoding);

    if (options.encoding === Encodings.Auto) console.debug(`encoding '${file.encoding}'`);

    // override escape if auto
    const escapeType =
      options.escape!.type === Escapes.Auto
        ? (() => {
            let inputExt = path.extname(input);
            let outputExt = path.extname(output);

            if (inputExt === '.json' || outputExt === '.json') {
              console.debug("escape 'json'");
              return Escapes.Json;
            }

            if (inputExt === '.xml' || outputExt === '.xml') {
              console.debug("escape 'xml'");
              return Escapes.Xml;
            }

            return Escapes.Off;
          })()
        : options.escape!.type;

    // replace tokens
    let result = replaceTokensInString(file.content, variables, tokenRegex, transformRegex, customEscapeRegex, {
      ...options,
      escape: { ...options.escape, ...{ type: escapeType } }
    });
    counters.defaults += result.counters.defaults;
    counters.replaced += result.counters.replaced;
    counters.tokens += result.counters.tokens;
    counters.transforms += result.counters.transforms;

    // write output
    await fs.mkdir(path.dirname(output), { recursive: true });

    if (counters.tokens > 0) {
      // write updated content if tokens where found
      await fs.writeFile(output, iconv.encode(result.content, file.encoding, { addBOM: options.addBOM }));
    } else if (input !== output) {
      // copy original file as binary if not token found
      await fs.copyFile(input, output);
    }

    console.info(
      `replaced ${counters.replaced} token${counters.replaced > 1 ? 's' : ''} out of ${counters.tokens}${counters.defaults > 0 ? ` (using ${counters.defaults} default value${counters.defaults > 1 ? 's' : ''})` : ''}${counters.transforms > 0 ? ` (running ${counters.transforms} transform${counters.transforms > 1 ? 's' : ''})` : ''}`
    );

    return counters;
  } finally {
    console.groupEnd();
  }
}

function replaceTokensInString(
  content: string,
  variables: { [key: string]: string },
  tokenRegex: RegExp,
  transformRegex: RegExp,
  customEscapeRegex: RegExp | undefined,
  options: Options,
  names: string[] = []
): { content: string; counters: Counter } {
  let counters = new Counter();
  content = content.replace(tokenRegex, (match, name) => {
    ++counters.tokens;

    // extract transform
    let transformName: string | undefined = undefined;
    let transformParams: string[] = [];
    if (options.transforms!.enabled) {
      let m = name.match(transformRegex);
      if (m) {
        transformName = (m[1] ?? '').toLowerCase();
        transformParams = m[2].split(',').map((x: string) => x.trim());
        name = transformParams.shift(); // variable name must be first parameter

        ++counters.transforms;
      }
    }

    // check recursion
    const key = name.toUpperCase();
    if (options.recursive && names.includes(key)) throw new Error(`found cycle with token '${name}'`);

    // replace token
    let value: string = variables[key];

    if (value === undefined) {
      // variable not found
      const logVariableNotFound = () => {
        (() => {
          switch (options.missing!.log) {
            case MissingVariables.Log.Error:
              return (m: string) => {
                console.error(m);
              };
            case MissingVariables.Log.Warn:
              return (m: string) => {
                console.warn(m);
              };
            default:
              return (m: string) => {};
          }
        })()(`variable '${name}' not found`);
      };

      switch (options.missing!.action) {
        case MissingVariables.Action.Keep:
          logVariableNotFound();
          value = match;
          break;

        case MissingVariables.Action.Replace:
          value = options.missing!.default ?? '';
          ++counters.defaults;
          ++counters.replaced;
          break;

        default:
          logVariableNotFound();
          value = '';
          ++counters.replaced;
          break;
      }
    } else {
      ++counters.replaced;

      // apply recursion
      if (options.recursive) {
        let result = replaceTokensInString(
          value,
          variables,
          tokenRegex,
          transformRegex,
          customEscapeRegex,
          options,
          names.concat(key)
        );
        value = result.content;

        counters.defaults += result.counters.defaults;
        counters.replaced += result.counters.replaced;
        counters.tokens += result.counters.tokens;
        counters.transforms += result.counters.transforms;
      }
    }

    console.debug(`${name}: ${value}`); // log raw value

    // apply transform
    value = (() => {
      switch (transformName) {
        case undefined:
        case 'raw':
          return value;
        case 'lower':
          return value.toLowerCase();
        case 'upper':
          return value.toUpperCase();
        case 'base64':
          return Buffer.from(value).toString('base64');
        case 'indent':
          let i = ' '.repeat(parseInt(transformParams[0]) || 2);
          let v = value.replace(/(\r?\n)/g, `$1${i}`);

          return (transformParams[1] ?? '').toLowerCase() === 'true'
            ? `${i}${v}` // indent first line
            : v;
        default:
          console.warn(`unsupported transform '${transformName}'`);
          --counters.transforms;
          return value;
      }
    })();

    // apply escape
    if (transformName !== 'raw') {
      switch (options.escape!.type) {
        case Escapes.Json:
          value = value.replace(/["\\\b\f\n\r\t]/g, match => {
            switch (match) {
              case '"':
              case '\\':
                return `\\${match}`;
              case '\b':
                return '\\b';
              case '\f':
                return '\\f';
              case '\n':
                return '\\n';
              case '\r':
                return '\\r';
              case '\t':
                return '\\t';
            }

            return match;
          });
          break;

        case Escapes.Xml:
          value = value.replace(/[<>&'"]/g, match => {
            switch (match) {
              case '<':
                return '&lt;';
              case '>':
                return '&gt;';
              case '&':
                return '&amp;';
              case "'":
                return '&apos;';
              case '"':
                return '&quot;';
            }

            return match;
          });
          break;

        case Escapes.Custom:
          value = value.replace(customEscapeRegex!, `${options.escape!.escapeChar}$&`);
          break;
      }
    }

    // return value
    return value;
  });

  return { content: content, counters: counters };
}
