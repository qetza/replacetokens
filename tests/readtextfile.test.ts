import { readTextFile } from '../src';
import * as path from 'path';

const data = path.join(__dirname, 'data/readtextfile');

describe('readTextfile', () => {
  it('ascii', async () => {
    // act
    const result = await readTextFile(path.join(data, 'ascii.txt'));

    // assert
    expect(result.encoding).toEqual('ascii');
    expect(result.content).toEqual('ascii');
  });

  it('utf-8', async () => {
    // act
    const result = await readTextFile(path.join(data, 'utf-8.txt'));

    // assert
    expect(result.encoding).toEqual('utf-8');
    expect(result.content).toEqual('utf-8\n€');
  });

  it('utf-8 with BOM', async () => {
    // act
    const result = await readTextFile(path.join(data, 'utf-8bom.txt'));

    // assert
    expect(result.encoding).toEqual('utf-8');
    expect(result.content).toEqual('utf-8\n€');
  });

  it('utf-16be', async () => {
    // act
    const result = await readTextFile(path.join(data, 'utf-16be.txt'));

    // assert
    expect(result.encoding).toEqual('utf-16be');
    expect(result.content).toEqual('utf-16be\n€');
  });

  it('utf-16le', async () => {
    // act
    const result = await readTextFile(path.join(data, 'utf-16le.txt'));

    // assert
    expect(result.encoding).toEqual('utf-16le');
    expect(result.content).toEqual('utf-16le\n€');
  });

  it('windows1252', async () => {
    // act
    const result = await readTextFile(path.join(data, 'windows1252.txt'));

    // assert
    expect(result.encoding).toEqual('windows1252');
    expect(result.content).toEqual('windows1252\n€');
  });
});
