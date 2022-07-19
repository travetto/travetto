import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { Util } from '../src/util';

@Suite()
class TimeSuite {

  @Test()
  verifyMillis() {
    assert(Util.timeToMs(1000, 'ms') === 1000);
    assert(Util.timeToMs('1000ms') === 1000);
    assert(Util.timeToMs(1, 's') === 1000);
    assert(Util.timeToMs('1s') === 1000);
    // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
    assert(Util.timeToMs(.0166666666666666666666, 'm') === 1000);
    assert(Util.timeToMs('.0166666666666666666666m') === 1000);
  }

  @Test()
  verifyTime() {
    assert(Util.getEnvTime('max_age', '1s') === 1000);
    process.env.MAX_AGE = '5s';
    assert(Util.getEnvTime('max_age', '1s') === 5000);
    process.env.MAX_AGE = '5';
    assert(Util.getEnvTime('max_age', '1s') === 5);
    process.env.MAX_AGE = '5m';
    assert(Util.getEnvTime('max_age', '1s') === 5 * 1000 * 60);
    process.env.MAX_AGE = '5h';
    assert(Util.getEnvTime('max_age', '1s') === 5 * 1000 * 60 * 60);
    process.env.MAX_AGE = '5mh';
    assert(Util.getEnvTime('max_age', '1s') === 1000);
  }
}