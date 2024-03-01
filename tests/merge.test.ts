import { merge } from '../src';

describe('merge', () => {
  it('single object', () => {
    // arrange
    const source = { string: 'hello' };

    // act
    const result = merge(source);

    // assert
    expect(result).not.toBe(source);
    expect(result).toEqual(source);
  });

  it('multiple objects', async () => {
    // arrange
    const source1 = { msg: 'hello', private: true };
    const source2 = { msg: 'hello world!', count: 2 };

    // act
    const result = merge(source1, source2);

    // assert
    expect(result).toEqual({ msg: 'hello world!', private: true, count: 2 });
  });

  it('objects with array', async () => {
    // arrange
    const source1 = { msgs: ['hello'], private: true };
    const source2 = { msgs: ['hello', 'world!'], count: 2 };

    // act
    const result = merge(source1, source2);

    // assert
    expect(result).toEqual({ msgs: ['hello', 'world!'], private: true, count: 2 });
  });

  it('complex objects', async () => {
    // arrange
    const source1 = {
      scalar: 'string',
      array: [{ scalar: 'hello' }, { scalar: 'world!' }],
      obj: { scalar: true, obj: { scalar: 1.2, array: ['hello', { value: 'world!' }], scalar2: 'a' } }
    };
    const source2 = {
      array: [{ scalar: 'hello' }],
      obj: { scalar2: false, obj: { scalar: '1.3', array: ['hello world!'] } },
      count: 2
    };

    // act
    const result = merge(source1, source2);

    // assert
    expect(result).toEqual({
      scalar: 'string',
      array: [{ scalar: 'hello' }],
      obj: { scalar: true, scalar2: false, obj: { scalar: '1.3', array: ['hello world!'], scalar2: 'a' } },
      count: 2
    });
  });
});
