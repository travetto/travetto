import assert from 'node:assert';

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
    assert(TimeUtil.timeToMs(.0166666666666666666666, 'm') === 1000);
    assert(TimeUtil.timeToMs('.0166666666666666666666m') === 1000);
  }

  @Test()
  verifyPrettyDelta() {
    assert(TimeUtil.prettyDelta(1000, 's') === '1s');
    assert(TimeUtil.prettyDelta(1000) === '1000ms');
    assert(TimeUtil.prettyDelta(1000 * 10) === '10s');

    assert(TimeUtil.prettyDelta(1000 * 10 + 300) === '10s 300ms');

    assert(TimeUtil.prettyDelta(1000 * 60 * 10 + 300) === '10m');
    assert(TimeUtil.prettyDelta(1000 * 60 * 10 + 3 * 1000) === '10m 3s');

    assert(TimeUtil.prettyDelta(1000 * 60 * 60 * 10 + 3 * 1000) === '10h');
    assert(TimeUtil.prettyDelta(1000 * 60 * 60 * 10 + 3 * 1000 * 60) === '10h 3m');

    assert(TimeUtil.prettyDelta(1000 * 60 * 1.5) === '1m 30s');
    assert(TimeUtil.prettyDelta(1000 * 60 * 1.2) === '72s');
  }

  @Test()
  verifyTimeBetween() {
    const now = Date.now();
    assert(TimeUtil.unitsBetween(now - 1000 * 60 * 60 * 24 * 5, now, 'd') === 5);
    assert(TimeUtil.unitsBetween(now - 1000 * 60 * 60 * 24 * 5.5, now, 'd') === 5.5);
    assert(TimeUtil.unitsBetween(now - 1000 * 60 * 60 * 5, now, 'h') === 5);
    assert(TimeUtil.unitsBetween(now - 1000 * 60 * 5, now, 'm') === 5);
    assert(TimeUtil.unitsBetween(now - 1000 * 60 * 5.25, now, 'm') === 5.25);
    assert(TimeUtil.unitsBetween(now - 1000 * 5, now, 's') === 5);
    assert(TimeUtil.unitsBetween(now - 5, now, 'ms') === 5);
    assert(TimeUtil.unitsBetween(now, now - 1000 * 60 * 5.25, 'm') === -5.25);
  }
}