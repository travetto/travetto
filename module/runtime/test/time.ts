import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { TimeUtil } from '@travetto/runtime';

@Suite()
class TimeSuite {

  @Test()
  verifyMillis() {
    assert(TimeUtil.duration(1000, 'ms').total({ unit: 'milliseconds' }) === 1000);
    assert(TimeUtil.duration('1000ms').total({ unit: 'milliseconds' }) === 1000);
    assert(TimeUtil.duration(1, 's').total({ unit: 'milliseconds' }) === 1000);
    assert(TimeUtil.duration('1s').total({ unit: 'milliseconds' }) === 1000);
    assert(TimeUtil.duration(.0166666666666666666666, 'm').total({ unit: 'milliseconds' }) === 1000);
    assert(TimeUtil.duration('.0166666666666666666666m').total({ unit: 'milliseconds' }) === 1000);
  }

  @Test()
  verifyPrettyDelta() {
    assert(TimeUtil.asClock(1000) === '01s');
    assert(TimeUtil.asClock(1000 * 10) === '10s');

    assert(TimeUtil.asClock(1000 * 10 + 300) === '10s');

    assert(TimeUtil.asClock(1000 * 60 * 10 + 300) === '10m 00s');
    assert(TimeUtil.asClock(1000 * 60 * 10 + 3 * 1000) === '10m 03s');

    assert(TimeUtil.asClock(1000 * 60 * 60 * 10 + 3 * 1000) === '10h 00m');
    assert(TimeUtil.asClock(1000 * 60 * 60 * 10 + 3 * 1000 * 60) === '10h 03m');

    assert(TimeUtil.asClock(1000 * 60 * 1.5) === '01m 30s');
    assert(TimeUtil.asClock(1000 * 60 * 1.2) === '01m 12s');
  }
}