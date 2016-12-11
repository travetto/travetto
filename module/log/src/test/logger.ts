import * as process from 'process';
import { expect } from 'chai';
import * as fs from 'fs';
import { Logger } from '../lib';
import { nodeToPromise } from '@encore/util';

let name = process.cwd() + '/logs/encore_logging.log';

describe('Logging', () => {

  before(async () => {
    try {
      return await nodeToPromise<void>(fs, fs.unlink, name);
    } catch (e) {
      // Do nothing
    }
  });

  it('Should log', async () => {
    await Logger.info('Hello world');
    let contents = await nodeToPromise(fs, fs.readFile, name);
    expect(contents.toString()).to.contain('Hello world');
  });
}) 