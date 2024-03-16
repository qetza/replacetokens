import { parseVariables } from '../src';
import * as path from 'path';
import * as os from 'os';

const data = path.join(__dirname, 'data/parseVariables');
let debugSpy: jest.SpiedFunction<typeof console.debug>;

describe('parseVariables', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    debugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('objects', async () => {
    // act
    const result = await parseVariables([
      '{ "var1": "value1" } // comment',
      '{ /* comment */ "var2": { "sub2": ["value2"] } }'
    ]);

    // assert
    expect(debugSpy).not.toHaveBeenCalled();

    expect(result).toEqual({ VAR1: 'value1', 'VAR2.SUB2.0': 'value2' });
  });

  it('file: absolute', async () => {
    // act
    const result = await parseVariables([`@${path.join(data, 'vars.json').replace(/\\/g, '/')}`]);

    // assert
    expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, 'vars.json')}'`);

    expect(result).toEqual({ VAR1: 'value1', 'VAR2.SUB2.0': 'value2' });
  });

  it('file: glob', async () => {
    // act
    const result = await parseVariables(['@**/*.(json|jsonc|yml|yaml)'], { root: data });

    // assert
    expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, 'var.jsonc')}'`);
    expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, 'vars.json')}'`);
    expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, 'vars.yml')}'`);
    expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, 'vars.yaml')}'`);

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
    const result = await parseVariables(['@**/*.(json|jsons);!var.jsonc'], { root: data });

    // assert
    expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, 'vars.json')}'`);

    expect(result).toEqual({ VAR1: 'value1', 'VAR2.SUB2.0': 'value2' });
  });

  it('env', async () => {
    // arrange
    const vars = { var1: 'value1', var2: { sub2: ['value2'] } };
    process.env.REPLACETOKENS_TESTS_VARS =
      '{ "var1": "value1", /* comment */ "var2": { "sub2": ["value2"] } } // comment';

    try {
      // act
      const result = await parseVariables(['$REPLACETOKENS_TESTS_VARS']);

      // assert
      expect(debugSpy).toHaveBeenCalledWith("loading variables from env 'REPLACETOKENS_TESTS_VARS'");

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
      const result = await parseVariables([
        '{ "var1": "args", "var2": "args" }',
        `@${path.join(data, 'var.jsonc').replace(/\\/g, '/')}`,
        `@${path.join(data, '*.yml').replace(/\\/g, '/')}`,
        '$REPLACETOKENS_TESTS_VARS',
        '["array", { "var4": "array" }]',
        '{ "var_yml2": "inline" }'
      ]);

      // assert
      expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, 'var.jsonc')}'`);
      expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, 'vars.yml')}'`);
      expect(debugSpy).toHaveBeenCalledWith("loading variables from env 'REPLACETOKENS_TESTS_VARS'");

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

  it('options: separator', async () => {
    // act
    const result = await parseVariables(['{ "var1": "value1" }', '{ "var2": { "sub2": ["value2"] } }'], {
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
      const result = await parseVariables([`@${varsPath}`], { normalizeWin32: true });

      // assert
      expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${varsPath}'`);

      expect(result).toEqual({ VAR1: 'value1', 'VAR2.SUB2.0': 'value2' });
    });

    it('options: normalizeWin32=false', async () => {
      // arrange
      const varsPath = path.join(data, 'vars.json');

      // act
      const result = await parseVariables([`@${varsPath}`], { normalizeWin32: false });

      // assert
      expect(debugSpy).not.toHaveBeenCalled();

      expect(result).toEqual({});
    });
  } else {
    it('options: normalizeWin32=true', async () => {
      // arrange
      const varsPath = path.join(data, 'vars.json').replace(/\//g, '\\');

      // act
      const result = await parseVariables([`@${varsPath}`], { normalizeWin32: true });

      // assert
      expect(debugSpy).not.toHaveBeenCalledWith(`loading variables from file '${varsPath}'`);

      expect(result).toEqual({});
    });
  }

  it('options: dot', async () => {
    // act
    const result = await parseVariables(['@**/*.(json|jsonc)'], { root: data, dot: true });

    // assert
    expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, 'var.jsonc')}'`);
    expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, 'vars.json')}'`);
    expect(debugSpy).toHaveBeenCalledWith(`loading variables from file '${path.join(data, '.vars', 'var.json')}'`);

    expect(result).toEqual({ VAR1: 'value1', VAR2: 'file', 'VAR2.SUB2.0': 'value2', VAR3: 'file' });
  });
});
