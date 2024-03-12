import { replaceTokens, Counter, TokenPatterns, MissingVariables, Escapes } from '../src';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const tmp = path.join(__dirname, '_tmp/replacetokens');
const data = path.join(__dirname, 'data/replacetokens');

describe('replaceTokens', () => {
  beforeEach(async () => {
    jest.resetModules();

    await fs.mkdir(tmp, { recursive: true });
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    await fs.rm(tmp, { force: true, recursive: true });
  });

  async function copyData(source: string, dest: string): Promise<string> {
    dest = path.join(tmp, dest);
    await fs.copyFile(path.join(data, source), dest);

    return path.resolve(dest);
  }

  function normalizeSources(...sources: string[]): string[] {
    for (let i = 0; i < sources.length; ++i) sources[i] = sources[i].replace(/\\/g, '/');

    return sources;
  }

  function spyOnConsole() {
    return {
      debug: jest.spyOn(console, 'debug').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      group: jest.spyOn(console, 'group').mockImplementation(),
      groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation()
    };
  }

  function expectCountersToEqual(
    counters: Counter,
    defaults: number,
    files: number,
    replaced: number,
    tokens: number,
    transforms: number
  ) {
    expect(counters).toEqual({
      defaults: defaults,
      files: files,
      replaced: replaced,
      tokens: tokens,
      transforms: transforms
    });
  }

  async function expectFilesToEqual(actual: string, expected: string): Promise<void> {
    const a = await fs.readFile(actual, 'utf8');
    const e = await fs.readFile(path.join(data, expected), 'utf8');

    expect(a).toEqual(e);
  }

  describe('sources', () => {
    it('absolute input path', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(input), { var1: 'var1_value', var2: 'var2_value' });

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('relative input path', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(path.relative(process.cwd(), input)), {
        var1: 'var1_value',
        var2: 'var2_value'
      });

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('input path with wildcard', async () => {
      // arrange
      const input1 = await copyData('default.json', 'default1.json');
      const input2 = await copyData('default.json', 'default2.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(path.join(tmp, '*.json')), {
        var1: 'var1_value',
        var2: 'var2_value'
      });

      // assert
      expectCountersToEqual(result, 0, 2, 4, 4, 0);
      await expectFilesToEqual(input1, 'default.expected.json');
      await expectFilesToEqual(input2, 'default.expected.json');
    });

    it('negative input pattern', async () => {
      // arrange
      const input1 = await copyData('default.json', 'default1.json');
      const input2 = await copyData('default.json', 'default2.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(`${path.join(tmp, '*.json')};!${input2}`), {
        var1: 'var1_value',
        var2: 'var2_value'
      });

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input1, 'default.expected.json');
      await expectFilesToEqual(input2, 'default.json');
    });

    it('multiple input patterns', async () => {
      // arrange
      const input1 = await copyData('default.json', 'default1.json');
      const input2 = await copyData('default.json', 'default2.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(input1, input2), { var1: 'var1_value', var2: 'var2_value' });

      // assert
      expectCountersToEqual(result, 0, 2, 4, 4, 0);
      await expectFilesToEqual(input1, 'default.expected.json');
      await expectFilesToEqual(input2, 'default.expected.json');
    });

    it('relative input path with custom root', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources('default1.json'),
        { var1: 'var1_value', var2: 'var2_value' },
        { root: tmp }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('absolute output path', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      const output = path.join(tmp, 'output/default.json');
      const source = `${input} => ${output}`;
      spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(source), { var1: 'var1_value', var2: 'var2_value' });

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.json');
      await expectFilesToEqual(output, 'default.expected.json');
    });

    it('relative output path', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      const output = 'output/default.json';
      const source = `${input} => ${output}`;
      spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(source), { var1: 'var1_value', var2: 'var2_value' });

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.json');
      await expectFilesToEqual(path.join(tmp, output), 'default.expected.json');
    });

    it('output path with wildcard', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      const output = path.join(tmp, 'output/*2.json');
      const source = `${path.join(tmp, '*1.json')} => ${output}`;
      spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(source), { var1: 'var1_value', var2: 'var2_value' });

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.json');
      await expectFilesToEqual(path.join(tmp, 'output/default2.json'), 'default.expected.json');
    });
  });

  describe('variables', () => {
    it('logs', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      const consoleSpies = spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(input), {
        var1: 'var1_value',
        var2: 'var2_value',
        VAR3: ['var3_value0', 'var3_value1']
      });

      // assert
      expect(consoleSpies.group).toHaveBeenCalledWith('loading variables');
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded 'var1'");
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded 'var2'");
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded 'VAR3.0'");
      expect(consoleSpies.debug).toHaveBeenCalledWith("loaded 'VAR3.1'");
      expect(consoleSpies.info).toHaveBeenCalledWith('4 variables loaded');
      expect(consoleSpies.groupEnd).toHaveBeenCalled();
    });

    it('case insensitive', async () => {
      // arrange
      const input = await copyData('default.separator.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { VARS: [{ value: 'var1_value' }, { VALUE: 'var2_value' }] },
        { separator: ':' }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });
  });

  describe('token', () => {
    it('default pattern', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(input), { var1: 'var1_value', var2: 'var2_value' });

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('azure pipelines pattern', async () => {
      // arrange
      const input = await copyData('default.azurepipelines.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'var1_value', var2: 'var2_value' },
        {
          token: { pattern: TokenPatterns.AzurePipelines }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('double braces pattern', async () => {
      // arrange
      const input = await copyData('default.doublebraces.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'var1_value', var2: 'var2_value' },
        {
          token: { pattern: TokenPatterns.DoubleBraces }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('double underscores pattern', async () => {
      // arrange
      const input = await copyData('default.doubleunderscores.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'var1_value', var2: 'var2_value' },
        {
          token: { pattern: TokenPatterns.DoubleUnderscores }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('github actions pattern', async () => {
      // arrange
      const input = await copyData('default.githubactions.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'var1_value', var2: 'var2_value' },
        {
          token: { pattern: TokenPatterns.GithubActions }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('octopus pattern', async () => {
      // arrange
      const input = await copyData('default.octopus.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'var1_value', var2: 'var2_value' },
        {
          token: { pattern: TokenPatterns.Octopus }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('custom pattern', async () => {
      // arrange
      const input = await copyData('default.custom.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'var1_value', var2: 'var2_value' },
        {
          token: { pattern: TokenPatterns.Custom, prefix: '\\\\', suffix: '//' }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });
  });

  describe('missing action', () => {
    it('none', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        {},
        {
          missing: { action: MissingVariables.Action.None }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.empty.json');
    });

    it('keep', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        {},
        {
          missing: { action: MissingVariables.Action.Keep }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 0, 2, 0);
      await expectFilesToEqual(input, 'default.json');
    });

    it('replace', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        {},
        {
          missing: { action: MissingVariables.Action.Replace, default: 'default' }
        }
      );

      // assert
      expectCountersToEqual(result, 2, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.default.json');
    });
  });

  describe('missing log', () => {
    it('none', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      const consoleSpies = spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        {},
        {
          missing: { log: MissingVariables.Log.Off }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.empty.json');
      expect(consoleSpies.warn).not.toHaveBeenCalledWith("variable 'var1' not found");
    });

    it('warn', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      const consoleSpies = spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        {},
        {
          missing: { log: MissingVariables.Log.Warn }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.empty.json');
      expect(consoleSpies.warn).toHaveBeenCalledWith("variable 'var1' not found");
    });

    it('error', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      const consoleSpies = spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        {},
        {
          missing: { log: MissingVariables.Log.Error }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      expectFilesToEqual(input, 'default.expected.empty.json');
      expect(consoleSpies.error).toHaveBeenCalledWith("variable 'var1' not found");
    });
  });

  describe('transforms', () => {
    it('upper', async () => {
      // arrange
      const input = await copyData('default.upper.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'var1_value', var2: 'var2_value' },
        {
          transforms: { enabled: true }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 1);
      await expectFilesToEqual(input, 'default.expected.upper.json');
    });

    it('lower', async () => {
      // arrange
      const input = await copyData('default.lower.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'VAR1_VALUE', var2: 'var2_value' },
        {
          transforms: { enabled: true }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 1);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('base64', async () => {
      // arrange
      const input = await copyData('default.base64.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'var1_value', var2: 'var2_value' },
        {
          transforms: { enabled: true }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 1);
      await expectFilesToEqual(input, 'default.expected.base64.json');
    });

    it('raw', async () => {
      // arrange
      const input = await copyData('default.raw.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: '["var1", "value"]', var2: '{"value": "value"}' },
        { transforms: { enabled: true }, escape: { type: Escapes.Json } }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 2);
      await expectFilesToEqual(input, 'default.expected.raw.json');
    });

    it('indent without first line', async () => {
      // arrange
      const input = await copyData('default.indent.false.yml', 'default1.yml');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { vars: '- var1: value1\n- var2: value2' },
        { transforms: { enabled: true } }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 1, 1, 1);
      await expectFilesToEqual(input, 'default.expected.indent.yml');
    });

    it('indent with first line', async () => {
      // arrange
      const input = await copyData('default.indent.true.yml', 'default1.yml');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { vars: '- var1: value1\n- var2: value2' },
        { transforms: { enabled: true } }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 1, 1, 1);
      await expectFilesToEqual(input, 'default.expected.indent.yml');
    });

    it('unsupported', async () => {
      // arrange
      const input = await copyData('default.unsupported.json', 'default1.json');
      const consoleSpies = spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'var1_value', var2: 'var2_value' },
        {
          transforms: { enabled: true }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
      expect(consoleSpies.warn).toHaveBeenCalledWith("unsupported transform 'unknown'");
    });

    it('custom prefix & suffix', async () => {
      // arrange
      const input = await copyData('default.customupper.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: 'var1_value', var2: 'var2_value' },
        {
          transforms: { enabled: true, prefix: '[', suffix: ']' }
        }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 1);
      await expectFilesToEqual(input, 'default.expected.upper.json');
    });
  });

  describe('recursive', () => {
    it('recursive', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { VAR1: 'var1#{var3}#', var2: 'var2_value', var3: '_#{var4}#', VAR4: 'value' },
        { recursive: true }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 4, 4, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });

    it('fail on cycle', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      spyOnConsole();

      // act & assert
      await expect(
        replaceTokens(
          normalizeSources(input),
          { VAR1: 'var1#{var2}#', var2: '_#{var1}#', var3: 'value' },
          { recursive: true }
        )
      ).rejects.toThrow("found cycle with token 'var1'");
    });
  });

  describe('escape', () => {
    it('auto escape', async () => {
      // arrange
      const input1 = await copyData('default.json', 'default1.json');
      const input2 = await copyData('default.xml', 'default1.xml');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input1, input2),
        { var1: '"var\'\\1\n\r\t&<value>\b\f', var2: 'var2_value' },
        { escape: { type: Escapes.Auto } }
      );

      // assert
      expectCountersToEqual(result, 0, 2, 4, 4, 0);
      await expectFilesToEqual(input1, 'default.expected.escape.json');
      await expectFilesToEqual(input2, 'default.expected.escape.xml');
    });

    it('JSON escape', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.config');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: '"var\'\\1\n\r\t&<value>\b\f', var2: 'var2_value' },
        { escape: { type: Escapes.Json } }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.escape.json');
    });

    it('XML escape', async () => {
      // arrange
      const input = await copyData('default.xml', 'default1.config');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: '"var\'\\1\n\r\t&<value>\b\f', var2: 'var2_value' },
        { escape: { type: Escapes.Xml } }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.escape.xml');
    });

    it('no escape', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: '"var\\1\n\r\tvalue\b\f', var2: 'var2_value' },
        { escape: { type: Escapes.Off } }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.noescape.json');
    });

    it('custom escape', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.config');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { var1: '|var1_value', var2: 'var2_value' },
        { escape: { type: Escapes.Custom, escapeChar: '|', chars: '|_' } }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.customescape.json');
    });
  });

  describe('BOM', () => {
    it('add BOM', async () => {
      // arrange
      const input = await copyData('default.json', 'default1.json');
      const output = path.join(tmp, 'output/default.json');
      const source = `${input} => ${output}`;
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(source),
        { var1: 'var1_value', var2: 'var2_value' },
        { encoding: 'utf-8', addBOM: true }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(output, 'default.expected.bom.json');
    });

    it('no BOM', async () => {
      // arrange
      const input = await copyData('default.bom.json', 'default1.json');
      const output = path.join(tmp, 'output/default.json');
      const source = `${input} => ${output}`;
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(source),
        { var1: 'var1_value', var2: 'var2_value' },
        { encoding: 'utf-8', addBOM: false }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(output, 'default.expected.json');
    });
  });

  describe('separator', () => {
    it('flatten variables', async () => {
      // arrange
      const input = await copyData('default.separator.json', 'default1.json');
      spyOnConsole();

      // act
      const result = await replaceTokens(
        normalizeSources(input),
        { vars: [{ value: 'var1_value' }, { value: 'var2_value' }] },
        { separator: ':' }
      );

      // assert
      expectCountersToEqual(result, 0, 1, 2, 2, 0);
      await expectFilesToEqual(input, 'default.expected.json');
    });
  });

  describe('misc', () => {
    it('binary', async () => {
      // arrange
      const input = await copyData('icon.png', 'icon.png');
      spyOnConsole();

      // act
      const result = await replaceTokens(normalizeSources(input), { var1: 'var1_value', var2: 'var2_value' });

      // assert
      expectCountersToEqual(result, 0, 1, 0, 0, 0);

      let buffer: Buffer = await fs.readFile(input);
      let hash = crypto.createHash('sha256');
      hash.update(buffer);
      const actual: string = hash.digest('hex');

      buffer = await fs.readFile(path.join(data, 'icon.png'));
      hash = crypto.createHash('sha256');
      hash.update(buffer);
      const expected: string = hash.digest('hex');

      expect(actual).toEqual(expected);
    });
  });
});
