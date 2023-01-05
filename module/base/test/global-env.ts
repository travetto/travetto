import assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { defineGlobalEnv, GlobalEnv } from '../src/global-env';

@Suite()
export class GlobalEnvTest {

  @Test()
  testDefine() {
    defineGlobalEnv({ envName: 'prod' });
    assert(process.env.NODE_ENV === 'production');
    assert(process.env.TRV_ENV === 'prod');
    assert(GlobalEnv.prod);
  }
}