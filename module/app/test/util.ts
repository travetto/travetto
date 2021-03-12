import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { AppUtil } from '../src/util';
import { ApplicationParameter } from '../src/types';

@Suite()
export class UtilTest {

  @Test()
  async enforceParamType() {
    const config: ApplicationParameter = {
      name: 'yeah',
      type: 'string',
      subtype: 'choice',
      meta: {
        choices: ['a', 'b', 'c']
      }
    };
    assert(AppUtil.enforceParamType(config, 'a') === 'a');

    assert.throws(() => {
      AppUtil.enforceParamType(config, 'd');
    });

    const config2: ApplicationParameter = {
      name: 'age',
      type: 'number'
    };
    assert(AppUtil.enforceParamType(config2, '0') === 0);

    assert.throws(() => {
      AppUtil.enforceParamType(config2, 'a');
    });
  }
}