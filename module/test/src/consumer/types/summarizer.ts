import type { SuiteResult } from '../../model/suite.ts';
import type { TestEvent } from '../../model/event.ts';
import type { SuitesSummary, TestConsumerShape } from '../types.ts';

/**
 * Test Result Collector, combines all results into a single Suite Result
 */
export class TestResultsSummarizer implements TestConsumerShape {

  summary: SuitesSummary = {
    passed: 0, failed: 0, errored: 0, skipped: 0, unknown: 0,
    total: 0, duration: 0, suites: []
  };

  #merge(result: SuiteResult): void {
    for (const test of Object.values(result.tests)) {
      this.summary[test.status] += 1;
    }
    this.summary.total += result.total;
    this.summary.duration += result.duration;
    this.summary.suites.push(result);
  }

  /**
   * Merge all test results into a single Suite Result
   */
  onEvent(event: TestEvent): void {
    if (event.type === 'suite' && event.phase === 'after') {
      this.#merge(event.suite);
    }
  }
}
