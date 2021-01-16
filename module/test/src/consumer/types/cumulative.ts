import { Class } from '@travetto/base';

import { TestConsumer } from '../types';
import { TestEvent } from '../../model/event';
import { TestResult } from '../../model/test';
import { SuiteResult } from '../../model/suite';
import { SuiteRegistry } from '../../registry/suite';

/**
 * Cumulative Summary consumer
 */
export class CumulativeSummaryConsumer implements TestConsumer {
  /**
   * Total state of all tests run so far
   */
  private state: Record<string, Record<string, TestResult['status']>> = {};

  constructor(private target: TestConsumer) { }

  /**
   * Summarize a given test suite using the new result and the historical
   * state
   */
  summarizeSuite(test: TestResult): SuiteResult {
    try {
      require(test.file);
      this.state[test.classId] = this.state[test.classId] ?? {};
      this.state[test.classId][test.methodName] = test.status;
      const SuiteCls = SuiteRegistry.getClasses().find(x =>
        x.ᚕid === test.classId
      )!;
      return this.computeTotal(SuiteCls);
    } catch {
      return this.removeClass(test.classId);
    }
  }

  /**
   * Remove a class
   */
  removeClass(clsId: string) {
    this.state[clsId] = {};
    return {
      classId: clsId, passed: 0, failed: 0, skipped: 0, total: 0, tests: [], duration: 0, file: '', lines: { start: 0, end: 0 }
    };
  }

  /**
   * Compute totals
   */
  computeTotal(cls: Class) {
    const suite = SuiteRegistry.get(cls);
    const total = suite.tests.reduce((acc, x) => {
      const status = this.state[x.classId][x.methodName] ?? 'unknown';
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
      console.warn('Summarization Error', { error: err });
    }
  }
}