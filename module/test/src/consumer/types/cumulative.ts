import { TestConsumer } from '../types';
import { TestEvent } from '../../model/event';
import { TestResult } from '../../model/test';
import { SuiteResult } from '../../model/suite';
import { TestRegistry } from '../../registry/registry';

/**
 * Cumulative Summary consumer
 */
export class CumulativeSummaryConsumer implements TestConsumer {
  /**
   * Total state of all tests run so far
   */
  private state: Record<string, TestResult['status']> = {};

  constructor(private target: TestConsumer) { }

  /**
   * Summarize a given test suite using the new result and the historical
   * state
   */
  summarizeSuite(test: TestResult): SuiteResult {
    require(test.file);

    this.state[`${test.classId}!${test.methodName}`] = test.status;
    const SuiteCls = TestRegistry.getClasses().find(x =>
      x.__id === test.classId
    )!;

    const suite = TestRegistry.get(SuiteCls);
    const total = suite.tests.reduce((acc, x) => {
      const status = this.state[`${x.classId}!${x.methodName}`] ?? 'unknown';
      acc[status] += 1;
      return acc;
    }, { skipped: 0, passed: 0, failed: 0, unknown: 0 });

    return {
      classId: suite.classId,
      passed: total.passed,
      failed: total.failed,
      skipped: total.skipped,
      file: suite.file,
      lines: suite.lines,
      total: total.failed + total.passed,
      tests: [],
      duration: 0
    };
  }

  /**
   * Listen for event, process the full event, and if the event is an after test,
   * send a full suite summary
   */
  onEvent(e: TestEvent) {
    this.target.onEvent(e);
    try {
      if (e.type === 'test' && e.phase === 'after') {
        this.target.onEvent({
          type: 'suite',
          phase: 'after',
          suite: this.summarizeSuite(e.test)
        });
      }
    } catch (err) {
      console.error(err);
    }
  }
}