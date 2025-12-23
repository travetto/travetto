import type { Counts } from './suite';
import type { TestStatus } from './test';

export class TestModelUtil {
  static countsToTestStatus(counts: Counts): TestStatus {
    return counts.failed ? 'failed' : (counts.passed ? 'passed' : counts.skipped ? 'skipped' : 'unknown');
  }
}