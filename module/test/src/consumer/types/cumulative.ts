import { existsSync } from 'node:fs';

import { Class, RuntimeIndex } from '@travetto/runtime';

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
  #state: Record<string, Record<string, TestResult['status']>> = {};
  #target: TestConsumer;

  constructor(target: TestConsumer) {
    this.#target = target;
  }

  /**
   * Summarize a given test suite using the new result and the historical
   * state
   */
  summarizeSuite(test: TestResult): SuiteResult {
    // Was only loading to verify existence (TODO: double-check)
    if (existsSync(RuntimeIndex.getFromImport(test.import)!.sourceFile)) {
      this.#state[test.classId] = this.#state[test.classId] ?? {};
      this.#state[test.classId][test.methodName] = test.status;
      const SuiteCls = SuiteRegistry.getClasses().find(x =>
        x.Ⲑid === test.classId
      )!;
      if (SuiteCls) {
        return this.computeTotal(SuiteCls);
      } else {
        return this.removeClass(test.classId);
      }
    } else {
      return this.removeClass(test.classId);
    }
  }

  /**
   * Remove a class
   */
  removeClass(clsId: string): SuiteResult {
    this.#state[clsId] = {};
    return {
      classId: clsId, passed: 0, failed: 0, skipped: 0, total: 0, tests: [], duration: 0,
      import: '', lineStart: 0, lineEnd: 0, file: ''
    };
  }

  /**
   * Compute totals
   */
  computeTotal(cls: Class): SuiteResult {
    const suite = SuiteRegistry.get(cls);
    const total = suite.tests.reduce((acc, x) => {
      const status = this.#state[x.classId][x.methodName] ?? 'unknown';
      acc[status] += 1;
      return acc;
    }, { skipped: 0, passed: 0, failed: 0, unknown: 0 });

    return {
      classId: suite.classId,
      passed: total.passed,
      failed: total.failed,
      skipped: total.skipped,
      import: suite.import,
      file: suite.file,
      lineStart: suite.lineStart,
      lineEnd: suite.lineEnd,
      total: total.failed + total.passed,
      tests: [],
      duration: 0
    };
  }

  /**
   * Listen for event, process the full event, and if the event is an after test,
   * send a full suite summary
   */
  onEvent(e: TestEvent): void {
    this.#target.onEvent(e);
    try {
      if (e.type === 'test' && e.phase === 'after') {
        this.#target.onEvent({
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