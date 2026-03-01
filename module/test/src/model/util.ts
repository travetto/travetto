import type { Counts } from './suite.ts';
import type { TestStatus } from './test.ts';

export class TestModelUtil {
  static countsToTestStatus(counts: Counts): TestStatus {
    switch (true) {
      case counts.errored > 0: return 'errored';
      case counts.failed > 0: return 'failed';
      case counts.skipped > 0: return 'skipped';
      case counts.unknown > 0: return 'unknown';
      default: return 'passed';
    }
  }
}