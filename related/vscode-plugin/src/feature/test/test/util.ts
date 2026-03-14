import type { ResultsSummary, TestStatus } from '@travetto/test';

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

  static buildSummary(): ResultsSummary {
    return { passed: 0, failed: 0, skipped: 0, errored: 0, unknown: 0, total: 0, duration: 0 };
  }

  static countTestResult<T extends ResultsSummary>(summary: T, tests: { status: TestStatus, duration?: number }[]): T {
    for (const test of tests) {
      summary[test.status] += 1;
      summary.total += 1;
      summary.duration += (test.duration ?? 0);
    }
    return summary;
  }
}