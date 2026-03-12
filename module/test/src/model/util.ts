import type { ResultsSummary } from './suite.ts';
import type { TestStatus } from './test.ts';

export class TestModelUtil {
  static computeTestStatus(summary: ResultsSummary): TestStatus {
    switch (true) {
      case summary.errored > 0: return 'errored';
      case summary.failed > 0: return 'failed';
      case summary.skipped > 0: return 'skipped';
      case summary.unknown > 0: return 'unknown';
      default: return 'passed';
    }
  }
}