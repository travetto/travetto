import type { SuiteResult } from '../../model/suite.ts';
import type { TestEvent } from '../../model/event.ts';
import type { SuitesSummary, TestConsumerShape } from '../types.ts';
import { TestModelUtil } from '../../model/util.ts';

/**
 * Test Result Collector, combines all results into a single Suite Result
 */
export class TestResultsSummarizer implements TestConsumerShape {

  summary: SuitesSummary = {
    ...TestModelUtil.buildSummary(),
    suites: []
  };

  #merge(result: SuiteResult): void {
    TestModelUtil.countTestResult(this.summary, Object.values(result.tests));
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
