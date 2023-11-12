import assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { defineEnv, GlobalEnv } from '../src/global-env';

@Suite()
export class GlobalEnvTest {

  @Test()
  testDefine() {
    defineEnv({ envName: 'prod' });
    assert(process.env.NODE_ENV === 'production');
    assert(process.env.TRV_ENV === 'prod');
    assert(!GlobalEnv.devMode);
    assert(GlobalEnv.envName === 'prod');

    defineEnv({ envName: 'production' });
    assert(process.env.NODE_ENV === 'production');
    // @ts-ignore
    assert(process.env.TRV_ENV === 'production');
    assert(!GlobalEnv.devMode);
    // @ts-ignore
    assert(GlobalEnv.envName === 'production');
  }

  @Test()
  testEnvNameAndNodeEnvSep() {
    defineEnv({ envName: 'staging' });
    assert(process.env.NODE_ENV === 'production');
    assert(process.env.TRV_ENV === 'staging');
    assert(!GlobalEnv.devMode);
    assert(GlobalEnv.envName === 'staging');
  }
}