import { flattenAndMerge } from '../src';

describe('flattenAndMerge', () => {
  it('single object', () => {
    // arrange
    const source = { string: 'hello' };

    // act
    const result = flattenAndMerge('.', source);

    // assert
    expect(result).not.toBe(source);
    expect(result).toEqual({ STRING: 'hello' });
  });

  it('multiple objects', async () => {
    // arrange
    const source1 = { msg: 'hello', private: true };
    const source2 = { msg: 'hello world!', count: 2 };

    // act
    const result = flattenAndMerge('.', source1, source2);

    // assert
    expect(result).toEqual({ MSG: 'hello world!', PRIVATE: 'true', COUNT: '2' });
  });

  it('objects with array', async () => {
    // arrange
    const source1 = { msgs: ['hello'], private: true };
    const source2 = { msgs: ['hello', 'world!'], count: 2 };

    // act
    const result = flattenAndMerge('.', source1, source2);

    // assert
    expect(result).toEqual({
      'MSGS.0': 'hello',
      'MSGS.1': 'world!',
      PRIVATE: 'true',
      COUNT: '2'
    });
  });

  it('complex objects', async () => {
    // arrange
    const source1 = {
      scalar: 'string',
      array: [{ scalar: 'hello' }, { scalar: 'world!' }],
      obj: { scalar: true, obj: { scalar: 1.2, array: ['hello', { value: 'world!' }], scalar2: 'a' } }
    };
    const source2 = {
      ARRAY: [{ scalar: 'hello' }],
      obj: { scalar2: false, obj: { SCALAR: '1.3', array: ['hello world!'] } },
      count: 2
    };
    const source3 = [
      'a',
      {
        scalar: 2
      }
    ];

    // act
    const result = flattenAndMerge('.', source1, source2, source3);

    // assert
    expect(result).toEqual({
      SCALAR: 'string',
      'ARRAY.0.SCALAR': 'hello',
      'ARRAY.1.SCALAR': 'world!',
      'OBJ.SCALAR': 'true',
      'OBJ.SCALAR2': 'false',
      'OBJ.OBJ.SCALAR': '1.3',
      'OBJ.OBJ.ARRAY.0': 'hello world!',
      'OBJ.OBJ.ARRAY.1.VALUE': 'world!',
      'OBJ.OBJ.SCALAR2': 'a',
      COUNT: '2',
      '0': 'a',
      '1.SCALAR': '2'
    });
  });
});
