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
    skipped: 0,
    total: 0,
    duration: 0,
    suites: [],
    errors: []
  };

  #merge(src: SuiteResult): void {
    this.summary.suites.push(src);
    this.summary.failed += src.failed;
    this.summary.passed += src.passed;
    this.summary.skipped += src.skipped;
    this.summary.duration += src.duration;
    this.summary.total += (src.failed + src.passed + src.skipped);
  }

  /**
   * Merge all test results into a single Suite Result
   */
  onEvent(event: TestEvent): void {
    if (event.phase === 'after' && event.type === 'suite') {
      this.#merge(event.suite);
    }
  }
}
