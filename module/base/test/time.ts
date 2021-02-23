import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { TimeUtil } from '../src/internal/time';

@Suite()
class TimeUtilSuite {
  @Test()
  verifyMillis() {
    assert(TimeUtil.toMillis(1000, 'ms') === 1000);
    assert(TimeUtil.toMillis('1000', 'ms') === 1000);
    assert(TimeUtil.toMillis('1000ms') === 1000);
    assert(TimeUtil.toMillis(1, 's') === 1000);
    assert(TimeUtil.toMillis('1', 's') === 1000);
    assert(TimeUtil.toMillis('1s') === 1000);
    assert(TimeUtil.toMillis(.0166666666666666666666, 'm') === 1000);
    assert(TimeUtil.toMillis('.0166666666666666666666', 'm') === 1000);
    assert(TimeUtil.toMillis('.0166666666666666666666m') === 1000);
  }

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
    assert(isNaN(TimeUtil.getEnv('max_age', 1000)));
  }
}