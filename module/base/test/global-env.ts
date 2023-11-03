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
    assert(!GlobalEnv.devMode);
    assert(GlobalEnv.envName === 'prod');

    defineGlobalEnv({ envName: 'production' });
    assert(process.env.NODE_ENV === 'production');
    // @ts-ignore
    assert(process.env.TRV_ENV === 'production');
    assert(!GlobalEnv.devMode);
    // @ts-ignore
    assert(GlobalEnv.envName === 'production');
  }

  @Test()
  testEnvNameAndNodeEnvSep() {
    defineGlobalEnv({ envName: 'staging' });
    assert(process.env.NODE_ENV === 'production');
    assert(process.env.TRV_ENV === 'staging');
    assert(!GlobalEnv.devMode);
    assert(GlobalEnv.envName === 'staging');
  }
}