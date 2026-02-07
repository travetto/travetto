import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { TimeUtil } from '@travetto/runtime';

@Suite()
class TimeSuite {

  @Test()
  verifyDuration() {
    assert(TimeUtil.duration(1000).milliseconds === 1000);
    assert(TimeUtil.duration('10s').seconds === 10);
    assert(TimeUtil.duration('10m').minutes === 10);
    assert(TimeUtil.duration('10h').hours === 10);
    assert(TimeUtil.duration('10d').days === 10);
    assert(TimeUtil.duration('10w').weeks === 10);
    assert(TimeUtil.duration('10y').years === 10);

    assert(TimeUtil.duration('10').milliseconds === 10);

    assert(TimeUtil.duration('-10s').seconds === -10);

    assert.throws(() => TimeUtil.duration('abc'), /Unable to parse/);
  }

  @Test()
  verifyDurationTypes() {
    // Full names
    for (const unit of ['years',  'months',  'weeks', 'days', 'hours',  'minutes', 'seconds', 'milliseconds'] as const) {
      assert(TimeUtil.duration(`10${unit}`)[unit] === 10);
      assert(TimeUtil.duration(`10${unit.replace(/s$/, '' )}`)[unit] === 10);
    }

    // Aliases
    assert(TimeUtil.duration('10ms').milliseconds === 10);
    assert(TimeUtil.duration('10M').months === 10);

    // Negative numbers
    assert(TimeUtil.duration(-1000).milliseconds === -1000);
    assert(TimeUtil.duration('-1000').milliseconds === -1000);

    // Passthrough
    const dur = TimeUtil.duration('10s');
    assert(TimeUtil.duration(dur).total({ unit: 'seconds' }) === 10);
  }

  @Test()
  verifyDurationConversion() {
    assert(TimeUtil.duration('1m', 'ms') === 60000);
    assert(TimeUtil.duration('1h', 'm') === 60);
    assert(TimeUtil.duration('1d', 'h') === 24);
    assert(TimeUtil.duration('60s', 'm') === 1);
    assert(TimeUtil.duration('3000ms', 's') === 3);

    assert(TimeUtil.duration(1000, 's') === 1);

    const d = TimeUtil.duration('1m');
    assert(TimeUtil.duration(d, 's') === 60);
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