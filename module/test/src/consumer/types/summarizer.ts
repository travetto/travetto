import type { SuiteResult } from '../../model/suite.ts';
import type { TestEvent } from '../../model/event.ts';
import type { SuitesSummary, TestConsumerShape } from '../types.ts';

/**
 * Test Result Collector, combines all results into a single Suite Result
 */
export class TestResultsSummarizer implements TestConsumerShape {

  summary: SuitesSummary = {
    passed: 0,
    failed: 0,
    errored: 0,
    skipped: 0,
    unknown: 0,
    total: 0,
    duration: 0,
    suites: [],
    errors: []
  };

  #merge(result: SuiteResult): void {
    this.summary.suites.push(result);
    this.summary.failed += result.failed;
    this.summary.errored += result.errored;
    this.summary.passed += result.passed;
    this.summary.unknown += result.unknown;
    this.summary.skipped += result.skipped;
    this.summary.duration += result.duration;
    this.summary.total += result.total;
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
