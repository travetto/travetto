import { AllSuitesResult, SuiteResult } from '../model/suite';
import { TestEvent } from '../model/event';
import { TestConsumer } from './types';

/**
 * Test Reuslt Collector, combines all results into a single Suite Result
 */
export class TestResultsSummarizer implements TestConsumer {

  public summary: AllSuitesResult = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    duration: 0,
    suites: [],
    errors: []
  };

  private merge(src: SuiteResult) {
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
  onEvent(e: TestEvent) {
    if (e.phase === 'after' && e.type === 'suite') {
      this.merge(e.suite);
    }
  }
}
