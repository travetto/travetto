import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';

import { TimeUtil } from '../src/time';

@Suite()
class TimeSuite {

  @Test()
  verifyMillis() {
    assert(TimeUtil.asMillis(1000, 'ms') === 1000);
    assert(TimeUtil.asMillis('1000ms') === 1000);
    assert(TimeUtil.asMillis(1, 's') === 1000);
    assert(TimeUtil.asMillis('1s') === 1000);
    assert(TimeUtil.asMillis(.0166666666666666666666, 'm') === 1000);
    assert(TimeUtil.asMillis('.0166666666666666666666m') === 1000);
  }

  @Test()
  verifyPrettyDelta() {
    assert(TimeUtil.asClock(1000) === '00m 01s');
    assert(TimeUtil.asClock(1000 * 10) === '00m 10s');

    assert(TimeUtil.asClock(1000 * 10 + 300) === '00m 10s');

    assert(TimeUtil.asClock(1000 * 60 * 10 + 300) === '10m 00s');
    assert(TimeUtil.asClock(1000 * 60 * 10 + 3 * 1000) === '10m 03s');

    assert(TimeUtil.asClock(1000 * 60 * 60 * 10 + 3 * 1000) === '600m 03s');
    assert(TimeUtil.asClock(1000 * 60 * 60 * 10 + 3 * 1000 * 60) === '603m 00s');

    assert(TimeUtil.asClock(1000 * 60 * 1.5) === '01m 30s');
    assert(TimeUtil.asClock(1000 * 60 * 1.2) === '01m 12s');
  }
}