import type { Counts } from './suite.ts';
import type { TestStatus } from './test.ts';

export class TestModelUtil {
  static countsToTestStatus(counts: Counts): TestStatus {
    return counts.failed ? 'failed' : (counts.passed ? 'passed' : counts.skipped ? 'skipped' : 'unknown');
  }
}