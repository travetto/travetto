import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { TimeUtil } from '../src/internal/time';

class Test2 { }

@Suite()
class TimeUtilSuite {
  @Test()
  verifyTime() {
    assert(TimeUtil.getEnv('max_age', 1000) === 1000);
    process.env.MAX_AGE = '5s';
    assert(TimeUtil.getEnv('max_age', 1000) === 5000);
    process.env.MAX_AGE = '5';
    assert(TimeUtil.getEnv('max_age', 1000) === 5);
    process.env.MAX_AGE = '5m';
    assert(TimeUtil.getEnv('max_age', 1000) === 5 * 1000 * 60);
    process.env.MAX_AGE = '5h';
    assert(TimeUtil.getEnv('max_age', 1000) === 5 * 1000 * 60 * 60);
    process.env.MAX_AGE = '5mh';
    assert(TimeUtil.getEnv('max_age', 1000) === 1000);
  }
}