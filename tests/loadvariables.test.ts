import { loadVariables } from '../src';
import * as path from 'path';
import * as os from 'os';

const data = path.join(__dirname, 'data/loadvariables');
let consoleSpies: {
  debug: jest.SpiedFunction<typeof console.debug>;
  info: jest.SpiedFunction<typeof console.info>;
  warn: jest.SpiedFunction<typeof console.warn>;
  error: jest.SpiedFunction<typeof console.error>;
  group: jest.SpiedFunction<typeof console.group>;
  groupEnd: jest.SpiedFunction<typeof console.groupEnd>;
};

describe('loadVariables', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    consoleSpies = {
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

  it('objects', async () => {
    // act
    const result = await loadVariables([
      '{ "var1": "value1" } // comment',
      '{ /* comment */ "var2": { "sub2": ["value2"] } }'
    ]);

    // assert
    expect(result).toEqual({ VAR1: 'value1', 'VAR2.SUB2.0': 'value2' });
  });

  it('file: absolute', async () => {
    // act
    const result = await loadVariables([`@${path.join(data, 'vars.json').replace(/\\/g, '/')}`]);

    // assert
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'vars.json')}'`);

    expect(result).toEqual({ VAR1: 'value1', 'VAR2.SUB2.0': 'value2' });
  });

  it('file: glob', async () => {
    // act
    const result = await loadVariables(['@**/*.(json|jsonc|yml|yaml)'], { root: data });

    // assert
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'var.jsonc')}'`);
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'vars.json')}'`);
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'vars.yml')}'`);
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'vars.yaml')}'`);
    expect(consoleSpies.debug).not.toHaveBeenCalledWith(`loading from file '${path.join(data, '.vars.json')}'`);
    expect(consoleSpies.debug).not.toHaveBeenCalledWith(`loading from file '${path.join(data, '.vars', 'var.json')}'`);

    expect(result).toEqual({
      VAR1: 'value1',
      VAR2: 'file',
      'VAR2.SUB2.0': 'value2',
      VAR_YML1: 'file',
      VAR_YML2: 'file',
      VAR_YAML1: 'file',
      VAR_YAML2: 'file'
    });
  });

  it('file: multiple glob', async () => {
    // arrange
    const varsPath = '**/*.json';

    // act
    const result = await loadVariables(['@**/*.(json|jsons);!var.jsonc'], { root: data });

    // assert
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'vars.json')}'`);

    expect(result).toEqual({ VAR1: 'value1', 'VAR2.SUB2.0': 'value2' });
  });

  it('env', async () => {
    // arrange
    const vars = { var1: 'value1', var2: { sub2: ['value2'] } };
    process.env.REPLACETOKENS_TESTS_VARS =
      '{ "var1": "value1", /* comment */ "var2": { "sub2": ["value2"] } } // comment';

    try {
      // act
      const result = await loadVariables(['$REPLACETOKENS_TESTS_VARS']);

      // assert
      expect(consoleSpies.debug).toHaveBeenCalledWith("loading from env 'REPLACETOKENS_TESTS_VARS'");

      expect(result).toEqual({ VAR1: 'value1', 'VAR2.SUB2.0': 'value2' });
    } finally {
      delete process.env.REPLACETOKENS_TESTS_VARS;
    }
  });

  it('multiple', async () => {
    // arrange
    process.env.REPLACETOKENS_TESTS_VARS = '{ "var3": "env" }';

    try {
      // act
      const result = await loadVariables([
        '{ "var1": "args", "var2": "args" }',
        `@${path.join(data, 'var.jsonc').replace(/\\/g, '/')}`,
        `@${path.join(data, '*.yml').replace(/\\/g, '/')}`,
        '$REPLACETOKENS_TESTS_VARS',
        '["array", { "var4": "array" }]',
        '{ "var_yml2": "inline" }'
      ]);

      // assert
      expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'var.jsonc')}'`);
      expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'vars.yml')}'`);
      expect(consoleSpies.debug).toHaveBeenCalledWith("loading from env 'REPLACETOKENS_TESTS_VARS'");

      expect(result).toEqual({
        VAR1: 'args',
        VAR2: 'file',
        VAR3: 'env',
        '0': 'array',
        '1.VAR4': 'array',
        VAR_YML1: 'file',
        VAR_YML2: 'inline'
      });
    } finally {
      delete process.env.REPLACETOKENS_TESTS_VARS;
    }
  });

  it('logs', async () => {
    // arrange
    process.env.REPLACETOKENS_TESTS_VARS = '{ "var3": "env" }';

    try {
      // act
      const result = await loadVariables([
        '{ "var1": "args", "var2": "args" }',
        `@${path.join(data, 'var.jsonc').replace(/\\/g, '/')}`,
        `@${path.join(data, '*.yml').replace(/\\/g, '/')}`,
        '$REPLACETOKENS_TESTS_VARS',
        '["array", { "var4": "array" }]',
        '{ "var_yml2": "inline" }'
      ]);

      // assert
      expect(consoleSpies.group).toHaveBeenCalledWith('loading variables');
      expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'var.jsonc')}'`);
      expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'vars.yml')}'`);
      expect(consoleSpies.debug).toHaveBeenCalledWith("loading from env 'REPLACETOKENS_TESTS_VARS'");
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded 'VAR1'");
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded 'VAR2'");
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded 'VAR3'");
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded '0'");
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded '1.VAR4'");
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded 'VAR_YML1'");
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded 'VAR_YML2'");
      expect(consoleSpies.info).toHaveBeenCalledWith('7 variables loaded');
      expect(consoleSpies.groupEnd).toHaveBeenCalled();
    } finally {
      delete process.env.REPLACETOKENS_TESTS_VARS;
    }
  });

  it('options: separator', async () => {
    // act
    const result = await loadVariables(['{ "var1": "value1" }', '{ "var2": { "sub2": ["value2"] } }'], {
      separator: ':'
    });

    // assert
    expect(result).toEqual({ VAR1: 'value1', 'VAR2:SUB2:0': 'value2' });
  });

  if (os.platform() === 'win32') {
    it('options: normalizeWin32=true', async () => {
      // arrange
      const varsPath = path.join(data, 'vars.json');

      // act
      const result = await loadVariables([`@${varsPath}`], { normalizeWin32: true });

      // assert
      expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${varsPath}'`);

      expect(result).toEqual({ VAR1: 'value1', 'VAR2.SUB2.0': 'value2' });
    });

    it('options: normalizeWin32=false', async () => {
      // arrange
      const varsPath = path.join(data, 'vars.json');

      // act
      const result = await loadVariables([`@${varsPath}`], { normalizeWin32: false });

      // assert
      expect(consoleSpies.debug).not.toHaveBeenCalledWith(`loading from file '${varsPath}'`);

      expect(result).toEqual({});
    });
  } else {
    it('options: normalizeWin32=true', async () => {
      // arrange
      const varsPath = path.join(data, 'vars.json').replace(/\//g, '\\');

      // act
      const result = await loadVariables([`@${varsPath}`], { normalizeWin32: true });

      // assert
      expect(consoleSpies.debug).not.toHaveBeenCalledWith(`loading from file '${varsPath}'`);

      expect(result).toEqual({});
    });
  }

  it('options: dot', async () => {
    // act
    const result = await loadVariables(['@**/*.(json|jsonc)'], { root: data, dot: true });

    // assert
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'var.jsonc')}'`);
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'vars.json')}'`);
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, '.vars.json')}'`);
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, '.vars', 'var.json')}'`);

    expect(result).toEqual({ VAR1: 'value1', VAR2: 'file', 'VAR2.SUB2.0': 'value2', VAR3: 'file', VAR4: 'value4' });
  });

  it('options: caseInsensitive', async () => {
    // act
    const result = await loadVariables(['@**/vars2.json'], { root: data, caseInsensitive: true });

    // assert
    expect(consoleSpies.debug).toHaveBeenCalledWith(`loading from file '${path.join(data, 'VARS2.json')}'`);

    expect(result).toEqual({ VAR1: 'value1', 'VAR2.SUB2.0': 'value2' });
  });
});
