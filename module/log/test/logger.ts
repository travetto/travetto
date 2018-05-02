import * as fs from 'fs';
import * as util from 'util';
import * as assert from 'assert';

import { Suite, Test, BeforeEach, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { Logger } from '../src';
import { ConfigLoader, Config } from '@travetto/config';

@Suite('Suite')
class LoggerTest {

  @BeforeAll()
  async init() {
  }

  @Test('Should Log')
  async shouldLog() {
  }
}
