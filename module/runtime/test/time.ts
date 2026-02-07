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

    assert(TimeUtil.duration('10d').hours === 240);
    assert(TimeUtil.duration('10w').hours === 240 * 7);
    assert(TimeUtil.duration('10y').hours === 24 * 365 * 10);

    assert(TimeUtil.duration('10').milliseconds === 10);

    assert(TimeUtil.duration('-10s').seconds === -10);

    assert.throws(() => TimeUtil.duration('abc'), /Unable to parse/);
  }

  @Test()
  verifyDurationTypes() {
    // Full names
    for (const unit of ['hours', 'minutes', 'seconds', 'milliseconds'] as const) {
      assert(TimeUtil.duration(`10${unit}`)[unit] === 10);
      assert(TimeUtil.duration(`10${unit.replace(/s$/, '')}`)[unit] === 10);
    }

    assert(TimeUtil.duration('10d').days === 0);
    assert(TimeUtil.duration('10d').hours === 240);

    assert(TimeUtil.duration('10months').months === 0);
    assert(TimeUtil.duration('10M').hours === 10 * 24 * 30);

    assert(TimeUtil.duration('10weeks').weeks === 0);
    assert(TimeUtil.duration('10week').hours === 10 * 24 * 7);

    assert(TimeUtil.duration('10y').years === 0);
    assert(TimeUtil.duration('10y').hours === 10 * 24 * 365);

    // Aliases
    assert(TimeUtil.duration('10ms').milliseconds === 10);

    // Negative numbers
    assert(TimeUtil.duration(-1000).milliseconds === -1000);
    assert(TimeUtil.duration('-1000').milliseconds === -1000);
  }

  @Test()
  verifyDurationConversion() {
    assert(TimeUtil.duration('1m', 'ms') === 60000);
    assert(TimeUtil.duration('1h', 'm') === 60);
    assert(TimeUtil.duration('1d', 'h') === 24);
    assert(TimeUtil.duration('60s', 'm') === 1);
    assert(TimeUtil.duration('3000ms', 's') === 3);

    assert(TimeUtil.duration(1000, 's') === 1);

    assert(TimeUtil.duration('1m', 's') === 60);
  }

  @Test()
  verifyFromNow() {
    const start = Date.now();
    const future = TimeUtil.fromNow('10s');
    const diff = future.getTime() - start;
    // Allow for some execution time variance
    assert(diff >= 9000 && diff <= 11000);

    const past = TimeUtil.fromNow('-10s');
    const diffPast = start - past.getTime();
    assert(diffPast >= 9000 && diffPast <= 11000);

    // Test larger units conversion
    const futureDay = TimeUtil.fromNow('1d'); // Should count as 24 hours
    const diffDay = futureDay.getTime() - start;
    const dayMs = 24 * 60 * 60 * 1000;
    assert(diffDay >= (dayMs - 1000) && diffDay <= (dayMs + 1000));
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