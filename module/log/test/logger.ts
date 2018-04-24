import * as fs from 'fs';
import * as util from 'util';
import { assert } from 'console';

import { Suite, Test, BeforeEach, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { Logger } from '../src';

const name = `${process.cwd()}/logs/travetto_log-out.log`;
const fsTrunc = util.promisify(fs.truncate);
const fsRead = util.promisify(fs.readFile);

@Suite('Suite')
class LoggerTest {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
  }

  @BeforeEach()
  async truncate() {
    return await fsTrunc(name);
  }

  @Test('Should Log')
  async shouldLog() {
    const logger = (await DependencyRegistry.getInstance(Logger)).getLogger();
    logger.info('Hello world!');

    const contents = await fsRead(name);
    assert(contents.toString().includes('Hello world'));
  }
}
