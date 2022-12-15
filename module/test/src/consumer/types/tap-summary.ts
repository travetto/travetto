import { Writable } from 'stream';

import { ColorUtil, Util } from '@travetto/base';

import { SuitesSummary, TestConsumer } from '../types';
import { Consumable } from '../registry';

import { TestResultsEnhancer, COLOR_ENHANCER, DUMMY_ENHANCER } from '../enhancer';
import { TestEvent } from '../../model/event';

/**
  * TAP Format consumer
 */
@Consumable('summary')
export class SummaryEmitter implements TestConsumer {

  #stream: Writable;
  #enhancer: TestResultsEnhancer;

  constructor(
    stream: Writable = process.stdout,
    enhancer: TestResultsEnhancer = ColorUtil.colorize ? COLOR_ENHANCER : DUMMY_ENHANCER
  ) {
    this.#stream = stream;
    this.#enhancer = enhancer;
  }

  protected log(message: string): void {
    this.#stream.write(`${message}\n`);
  }

  onEvent(e: TestEvent): void {
    // Do nothing
  }

  /**
   * Summarize all results
   */
  onSummary(summary: SuitesSummary): void {
    this.log(`${this.#enhancer.testNumber(1)}..${this.#enhancer.testNumber(summary.total)}`);

    if (summary.errors.length) {
      this.log('---\n');
      for (const err of summary.errors) {
        this.log(this.#enhancer.failure(Util.hasToJSON(err) ? `${err.toJSON()}` : `${err}`));
      }
    }

    const allPassed = summary.failed === 0;

    this.log([
      this.#enhancer[allPassed ? 'success' : 'failure']('Results'),
      `${this.#enhancer.total(summary.passed)}/${this.#enhancer.total(summary.total)},`,
      allPassed ? 'failed' : this.#enhancer.failure('failed'),
      `${this.#enhancer.total(summary.failed)}`,
      'skipped',
      this.#enhancer.total(summary.skipped),
      `# (Total Time: ${summary.duration}ms)`
    ].join(' '));

    if (!allPassed) {
      for (const suite of summary.suites) {
        if (suite.failed) {
          for (const test of (suite.tests ?? [])) {
            if (test.status === 'failed') {
              this.log(`Test ${suite.classId}:${test.methodName}`);
              for (const assert of (test.assertions ?? [])) {
                if (assert.error) {
                  this.log(`${assert.classId}:${assert.line} => ${assert.text}\n${assert.error.stack}\n`);
                }
              }
            }
          }
        }
      }
    }
  }
}
