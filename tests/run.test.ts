import { run } from '../src/bin/run';
import * as rt from '../src';
import * as path from 'path';
import * as fs from 'fs/promises';

const data = path.join(__dirname, 'data/run');
const tmp = path.join(__dirname, '_tmp/run');

let replaceTokensSpy: jest.SpiedFunction<typeof rt.replaceTokens>;
let parseVariablesSpy: jest.SpiedFunction<typeof rt.parseVariables>;
let consoleSpies: {
  log: jest.SpiedFunction<typeof console.log>;
  debug: jest.SpiedFunction<typeof console.debug>;
  info: jest.SpiedFunction<typeof console.info>;
  warn: jest.SpiedFunction<typeof console.warn>;
  error: jest.SpiedFunction<typeof console.error>;
  group: jest.SpiedFunction<typeof console.group>;
  groupEnd: jest.SpiedFunction<typeof console.groupEnd>;
};

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    replaceTokensSpy = jest
      .spyOn(rt, 'replaceTokens')
      .mockResolvedValue({ defaults: 1, files: 2, replaced: 3, tokens: 3, transforms: 5 });
    parseVariablesSpy = jest.spyOn(rt, 'parseVariables').mockResolvedValue({});
    consoleSpies = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      group: jest.spyOn(console, 'group').mockImplementation(),
      groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation()
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function argv(...args: string[]) {
    return ['node', 'index.js', '--sources', 'file1', '--variables', '{}', ...args];
  }

  it('version', async () => {
    // arrange
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(code => {
      throw `exit: ${code}`;
    });

    jest.replaceProperty(process, 'argv', ['node', 'index.js', '--version']);

    // act
    try {
      await run();
    } catch (e) {
      expect(e).toEqual('exit: 0'); // catch for process.exit mock
    }

    // assert
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(consoleSpies.log).toHaveBeenCalledWith(
      JSON.parse(await fs.readFile(path.join(__dirname, '../package.json'), { encoding: 'utf-8' })).version
    );
  });

  it('mandatory arguments', async () => {
    // arrange
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(code => {
      throw `exit: ${code}`;
    });

    jest.replaceProperty(process, 'argv', ['node', 'index.js']);

    // act
    try {
      await run();
    } catch (e) {
      expect(e).toEqual('exit: 1'); // catch for process.exit mock
    }

    // assert
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleSpies.error).toHaveBeenCalledWith('Missing required arguments: sources, variables');
  });

  it('output', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv());

    // act
    await run();

    // assert
    expect(consoleSpies.log).toHaveBeenCalledWith(
      JSON.stringify({ defaults: 1, files: 2, replaced: 3, tokens: 3, transforms: 5 })
    );
  });

  it('sources', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', [
      'node',
      'index.js',
      '--sources',
      'folder/file1',
      'folder/file2',
      '--variables',
      '{}'
    ]);

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      ['folder/file1', 'folder/file2'],
      expect.any(Function),
      expect.anything()
    );
  });

  it('argument variables', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', [
      'node',
      'index.js',
      '--sources',
      'file1',
      '--variables',
      '{ "var1": "value1" }',
      '{ "var2": { "sub2": ["value2"] } }'
    ]);

    // act
    await run();

    // assert
    expect(parseVariablesSpy).toHaveBeenCalledWith(['{ "var1": "value1" }', '{ "var2": { "sub2": ["value2"] } }'], {
      normalizeWin32: false,
      separator: rt.Defaults.Separator
    });
    expect(replaceTokensSpy).toHaveBeenCalledWith(['file1'], expect.any(Function), expect.anything());
  });

  it('file variables', async () => {
    // arrange
    const varsPath = path.join(data, 'vars.json').replace(/\\/g, '/');

    jest.replaceProperty(process, 'argv', ['node', 'index.js', '--sources', 'file1', '--variables', `@${varsPath}`]);

    // act
    await run();

    // assert
    expect(parseVariablesSpy).toHaveBeenCalledWith([`@${varsPath}`], {
      normalizeWin32: false,
      separator: rt.Defaults.Separator
    });
    expect(replaceTokensSpy).toHaveBeenCalledWith(['file1'], expect.any(Function), expect.anything());
  });

  it('env variables', async () => {
    // arrange
    const vars = { var1: 'value1', var2: { sub2: ['value2'] } };

    process.env.REPLACETOKENS_TESTS_VARS = JSON.stringify(vars);

    try {
      jest.replaceProperty(process, 'argv', [
        'node',
        'index.js',
        '--sources',
        'file1',
        '--variables',
        '$REPLACETOKENS_TESTS_VARS'
      ]);

      // act
      await run();

      // assert
      expect(parseVariablesSpy).toHaveBeenCalledWith(['$REPLACETOKENS_TESTS_VARS'], {
        normalizeWin32: false,
        separator: rt.Defaults.Separator
      });
      expect(replaceTokensSpy).toHaveBeenCalledWith(['file1'], expect.any(Function), expect.anything());
    } finally {
      delete process.env.REPLACETOKENS_TESTS_VARS;
    }
  });

  it('merge variables', async () => {
    // arrange
    process.env.REPLACETOKENS_TESTS_VARS = '{ "var3": "env" } // comment';

    try {
      jest.replaceProperty(
        process,
        'argv',
        argv(
          '{ "var1": "args" } // comment',
          '@**/vars.(json|yml|yaml)',
          '@**/var.jsonc',
          '$REPLACETOKENS_TESTS_VARS',
          '["array", { "var4": "array" }]',
          '{ "var_yml2": "inline", "var_yaml1": "inline" }'
        )
      );

      // act
      await run();

      // assert
      expect(parseVariablesSpy).toHaveBeenCalledWith(
        [
          '{}',
          '{ "var1": "args" } // comment',
          '@**/vars.(json|yml|yaml)',
          '@**/var.jsonc',
          '$REPLACETOKENS_TESTS_VARS',
          '["array", { "var4": "array" }]',
          '{ "var_yml2": "inline", "var_yaml1": "inline" }'
        ],
        { normalizeWin32: false, separator: rt.Defaults.Separator }
      );
      expect(replaceTokensSpy).toHaveBeenCalledWith(['file1'], expect.any(Function), expect.anything());
    } finally {
      delete process.env.REPLACETOKENS_TESTS_VARS;
    }
  });

  it('default', async () => {
    // arrange
    const replaceTokensSpy = jest.spyOn(rt, 'replaceTokens').mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    jest.replaceProperty(process, 'argv', argv());

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(['file1'], expect.any(Function), {
      root: undefined,
      encoding: 'auto',
      token: {
        pattern: 'default',
        prefix: undefined,
        suffix: undefined
      },
      missing: {
        action: 'none',
        default: undefined,
        log: 'warn'
      },
      recursive: undefined,
      addBOM: undefined,
      escape: {
        type: 'auto',
        escapeChar: undefined,
        chars: undefined
      },
      transforms: {
        enabled: undefined,
        prefix: '(',
        suffix: ')'
      }
    });

    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).toHaveBeenCalled();
    expect(consoleSpies.warn).toHaveBeenCalled();
    expect(consoleSpies.error).toHaveBeenCalled();
    expect(consoleSpies.group).toHaveBeenCalled();
    expect(consoleSpies.groupEnd).toHaveBeenCalled();
  });

  it('log-level: debug', async () => {
    // arrange
    jest.spyOn(rt, 'replaceTokens').mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    jest.replaceProperty(process, 'argv', argv('--log-level', 'debug'));

    // act
    await run();

    // assert
    expect(consoleSpies.log).toHaveBeenCalledWith('{"defaults":1,"files":1,"replaced":1,"tokens":1,"transforms":1}');

    expect(consoleSpies.debug).toHaveBeenCalledWith('\x1b[90mdebug\x1b[0m');
    expect(consoleSpies.info).toHaveBeenCalledWith('info');
    expect(consoleSpies.warn).toHaveBeenCalledWith('\x1b[33mwarn\x1b[0m');
    expect(consoleSpies.error).toHaveBeenCalledWith('\x1b[31merror\x1b[0m');
    expect(consoleSpies.group).toHaveBeenCalledWith('\x1b[36m> group\x1b[0m');
    expect(consoleSpies.groupEnd).toHaveBeenCalled();
  });

  it('log-level: info', async () => {
    // arrange
    jest.spyOn(rt, 'replaceTokens').mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    jest.replaceProperty(process, 'argv', argv('--log-level', 'info'));

    // act
    await run();

    // assert
    expect(consoleSpies.log).toHaveBeenCalledWith('{"defaults":1,"files":1,"replaced":1,"tokens":1,"transforms":1}');

    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).toHaveBeenCalledWith('info');
    expect(consoleSpies.warn).toHaveBeenCalledWith('\x1b[33mwarn\x1b[0m');
    expect(consoleSpies.error).toHaveBeenCalledWith('\x1b[31merror\x1b[0m');
    expect(consoleSpies.group).toHaveBeenCalledWith('\x1b[36m> group\x1b[0m');
    expect(consoleSpies.groupEnd).toHaveBeenCalled();
  });

  it('log-level: warn', async () => {
    // arrange
    jest.spyOn(rt, 'replaceTokens').mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    jest.replaceProperty(process, 'argv', argv('--log-level', 'warn'));

    // act
    await run();

    // assert
    expect(consoleSpies.log).toHaveBeenCalledWith('{"defaults":1,"files":1,"replaced":1,"tokens":1,"transforms":1}');

    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.warn).toHaveBeenCalledWith('\x1b[33mwarn\x1b[0m');
    expect(consoleSpies.error).toHaveBeenCalledWith('\x1b[31merror\x1b[0m');
    expect(consoleSpies.group).not.toHaveBeenCalled();
    expect(consoleSpies.groupEnd).not.toHaveBeenCalled();
  });

  it('log-level: error', async () => {
    // arrange
    jest.spyOn(rt, 'replaceTokens').mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    jest.replaceProperty(process, 'argv', argv('--log-level', 'error'));

    // act
    await run();

    // assert
    expect(consoleSpies.log).toHaveBeenCalledWith('{"defaults":1,"files":1,"replaced":1,"tokens":1,"transforms":1}');

    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.error).toHaveBeenCalledWith('\x1b[31merror\x1b[0m');
    expect(consoleSpies.group).not.toHaveBeenCalled();
    expect(consoleSpies.groupEnd).not.toHaveBeenCalled();
  });

  it('log-level: none', async () => {
    // arrange
    jest.spyOn(rt, 'replaceTokens').mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    jest.replaceProperty(process, 'argv', argv('--log-level', 'none'));

    // act
    await run();

    // assert
    expect(consoleSpies.log).toHaveBeenCalledWith('{"defaults":1,"files":1,"replaced":1,"tokens":1,"transforms":1}');

    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.error).not.toHaveBeenCalled();
    expect(consoleSpies.group).not.toHaveBeenCalled();
    expect(consoleSpies.groupEnd).not.toHaveBeenCalled();
  });

  it('no-log-color', async () => {
    // arrange
    jest.spyOn(rt, 'replaceTokens').mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    jest.replaceProperty(process, 'argv', argv('--log-level', 'debug', '--no-log-color'));

    // act
    await run();

    // assert
    expect(consoleSpies.log).toHaveBeenCalledWith('{"defaults":1,"files":1,"replaced":1,"tokens":1,"transforms":1}');

    expect(consoleSpies.debug).toHaveBeenCalledWith('debug');
    expect(consoleSpies.info).toHaveBeenCalledWith('info');
    expect(consoleSpies.warn).toHaveBeenCalledWith('warn');
    expect(consoleSpies.error).toHaveBeenCalledWith('error');
    expect(consoleSpies.group).toHaveBeenCalledWith('> group');
    expect(consoleSpies.groupEnd).toHaveBeenCalled();
  });

  it('root', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--root', 'root'));

    // act
    await run();

    // assert
    expect(parseVariablesSpy).toHaveBeenCalledWith(['{}'], {
      normalizeWin32: false,
      root: 'root',
      separator: rt.Defaults.Separator
    });
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ root: 'root' })
    );
  });

  it('encoding', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--encoding', 'encoding'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ encoding: 'encoding' })
    );
  });

  it('token-pattern', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--token-pattern', 'octopus'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ token: expect.objectContaining({ pattern: 'octopus' }) })
    );
  });

  it('token-prefix', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--token-prefix', '[['));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ token: expect.objectContaining({ prefix: '[[' }) })
    );
  });

  it('token-suffix', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--token-suffix', ']]'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ token: expect.objectContaining({ suffix: ']]' }) })
    );
  });

  it('missing-var-action', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--missing-var-action', 'keep'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ missing: expect.objectContaining({ action: 'keep', default: undefined }) })
    );
  });

  it('missing-var-default', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--missing-var-action', 'replace', '--missing-var-default', 'default'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ missing: expect.objectContaining({ action: 'replace', default: 'default' }) })
    );
  });

  it('missing-var-log', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--missing-var-log', 'error'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ missing: expect.objectContaining({ log: 'error' }) })
    );
  });

  it('recursive', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--recursive'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ recursive: true })
    );
  });

  it('add-bom', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--add-bom'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ addBOM: true })
    );
  });

  it('escape', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--escape', 'xml'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ escape: expect.objectContaining({ type: 'xml' }) })
    );
  });

  it('escape-char', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--escape-char', '/'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ escape: expect.objectContaining({ escapeChar: '/' }) })
    );
  });

  it('chars-to-escape', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--chars-to-escape', 'abcd'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ escape: expect.objectContaining({ chars: 'abcd' }) })
    );
  });

  it('separator', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--separator', ':'));

    // act
    await run();

    // assert
    expect(parseVariablesSpy).toHaveBeenCalledWith(['{}'], { normalizeWin32: false, separator: ':' });
    expect(replaceTokensSpy).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.anything());
  });

  it('transforms', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--transforms'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ transforms: expect.objectContaining({ enabled: true }) })
    );
  });

  it('transforms-prefix', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--transforms-prefix', '['));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ transforms: expect.objectContaining({ prefix: '[' }) })
    );
  });

  it('transforms-suffix', async () => {
    // arrange
    jest.replaceProperty(process, 'argv', argv('--transforms-suffix', ']'));

    // act
    await run();

    // assert
    expect(replaceTokensSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ transforms: expect.objectContaining({ suffix: ']' }) })
    );
  });

  it('replace tokens', async () => {
    // arrange
    await fs.mkdir(tmp, { recursive: true });

    process.env.REPLACETOKENS_TESTS_VARS = '{ "var3": "env" } // comment';

    try {
      let input = path.join(tmp, 'file.txt');
      await fs.copyFile(path.join(data, 'file.txt'), input);

      input = path.resolve(input);

      jest.replaceProperty(process, 'argv', [
        'node',
        'index.js',
        '--sources',
        input.replace(/\\/g, '/'),
        '--variables',
        '{ "var1": "args" } // comment',
        '@**/vars.(json|yml|yaml)',
        '@**/var.jsonc',
        '$REPLACETOKENS_TESTS_VARS',
        '["array", { "var4": "array" }]',
        '{ "VAR_YML2": "inline", "var_yaml1": "inline" }',
        '--root',
        data,
        '--log-level',
        'debug'
      ]);

      parseVariablesSpy.mockRestore();
      replaceTokensSpy.mockRestore();

      // act
      await run();

      // assert
      expect(consoleSpies.log).toHaveBeenCalledWith(
        JSON.stringify({ tokens: 10, replaced: 10, files: 1, defaults: 0, transforms: 0 })
      );

      const actual = await fs.readFile(input, 'utf8');
      const expected = await fs.readFile(path.join(data, 'file.expected.txt'), 'utf8');

      expect(actual).toEqual(expected);
    } finally {
      delete process.env.REPLACETOKENS_TESTS_VARS;

      await fs.rm(tmp, { force: true, recursive: true });
    }
  });
});
