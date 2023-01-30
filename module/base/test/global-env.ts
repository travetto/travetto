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

  @Test()
  testMultipleDefine() {
    process.env.TRV_PROFILES = '';
    defineGlobalEnv({ envName: 'dev' });
    assert.deepStrictEqual(GlobalEnv.profiles, ['dev']);

    process.env.TRV_PROFILES = 'dev,dev';

    defineGlobalEnv({ envName: 'dev', profiles: ['dev'] });
    assert.deepStrictEqual(GlobalEnv.profiles, ['dev']);

    process.env.TRV_PROFILES = 'test,test1,test,test2';

    defineGlobalEnv({ profiles: ['dev'] });
    assert.deepStrictEqual(GlobalEnv.profiles, ['dev', 'test', 'test1', 'test2']);
  }
}