import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { TimeUtil } from '../src/time';

@Suite()
class TimeSuite {

  @Test()
  verifyMillis() {
    assert(TimeUtil.timeToMs(1000, 'ms') === 1000);
    assert(TimeUtil.timeToMs('1000ms') === 1000);
    assert(TimeUtil.timeToMs(1, 's') === 1000);
    assert(TimeUtil.timeToMs('1s') === 1000);
    // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
    assert(TimeUtil.timeToMs(.0166666666666666666666, 'm') === 1000);
    assert(TimeUtil.timeToMs('.0166666666666666666666m') === 1000);
  }

  @Test()
  verifyTime() {
    assert(TimeUtil.getEnvTime('max_age', '1s') === 1000);
    process.env.MAX_AGE = '5s';
    assert(TimeUtil.getEnvTime('max_age', '1s') === 5000);
    process.env.MAX_AGE = '5';
    assert(TimeUtil.getEnvTime('max_age', '1s') === 5);
    process.env.MAX_AGE = '5m';
    assert(TimeUtil.getEnvTime('max_age', '1s') === 5 * 1000 * 60);
    process.env.MAX_AGE = '5h';
    assert(TimeUtil.getEnvTime('max_age', '1s') === 5 * 1000 * 60 * 60);
    process.env.MAX_AGE = '5mh';
    assert(TimeUtil.getEnvTime('max_age', '1s') === 1000);
  }
}