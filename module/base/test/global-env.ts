import assert from 'assert';

import { Test, Suite, AfterEach, BeforeEach } from '@travetto/test';
import { defineGlobalEnv, GlobalEnv } from '../src/global-env';

@Suite()
export class GlobalEnvTest {

  #env?: NodeJS.ProcessEnv;

  @BeforeEach()
  copy() {
    this.#env = process.env;
    process.env = {};
  }

  @AfterEach()
  restore() {
    if (this.#env) {
      process.env = this.#env;
      this.#env = undefined;
    }
  }

  @Test()
  testDefine() {
    defineGlobalEnv({ envName: 'prod' });
    assert(process.env.NODE_ENV === 'production');
    assert(process.env.TRV_ENV === 'prod');
    assert(GlobalEnv.prod);
  }
}