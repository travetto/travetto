import * as process from 'process';
import { expect } from 'chai';
import * as fs from 'fs';
import { Logger } from '../lib';
import { nodeToPromise } from '@encore/util';

let name = process.cwd() + '/logs/_encore_logging.log';

describe('Logging', () => {

  before(async () => {
    try {
      return await nodeToPromise<void>(fs, fs.unlinkSync, name);
    } catch (e) {
      // Do nothing
    }
  });

  it('Should log', async () => {
    Logger.info('Hello world');
    let contents = fs.readFileSync(name).toString();
    expect(contents).to.contain('Hello world');
  });
}) 