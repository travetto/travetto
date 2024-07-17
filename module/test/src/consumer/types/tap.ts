import { RuntimeIndex } from '@travetto/manifest';
import { Terminal } from '@travetto/terminal';
import { AppError, TimeUtil } from '@travetto/base';
import { stringify } from 'yaml';

import { TestEvent } from '../../model/event';
import { SuitesSummary, TestConsumer } from '../types';
import { Consumable } from '../registry';
import { ErrorUtil } from '../error';
import { TestResultsEnhancer, CONSOLE_ENHANCER } from '../enhancer';

/**
  * TAP Format consumer
 */
@Consumable('tap')
export class TapEmitter implements TestConsumer {
  #count = 0;
  #enhancer: TestResultsEnhancer;
  #terminal: Terminal;
  #start: number;

  constructor(
    terminal = new Terminal(),
    enhancer: TestResultsEnhancer = CONSOLE_ENHANCER
  ) {
    this.#terminal = terminal;
    this.#enhancer = enhancer;
  }

  log(message: string): void {
    this.#terminal.writer.writeLine(message).commit();
  }

  /**
   * Preamble
   */
  onStart(): void {
    this.#start = Date.now();
    this.log(this.#enhancer.suiteName('TAP version 13')!);
  }

  /**
   * Output supplemental data (e.g. logs)
   */
  logMeta(obj: Record<string, unknown>): void {
    const lineLength = this.#terminal.width - 5;
    let body = stringify(obj, { lineWidth: lineLength });
    body = body.split('\n').map(x => `  ${x}`).join('\n');
    this.log(`---\n${this.#enhancer.objectInspect(body)}\n...`);
  }

  /**
   * Listen for each event
   */
  onEvent(e: TestEvent): void {
    if (e.type === 'test' && e.phase === 'after') {
      const { test } = e;
      const suiteId = this.#enhancer.suiteName(test.classId);
      let header = `${suiteId} - ${this.#enhancer.testName(test.methodName)}`;
      if (test.description) {
        header += `: ${this.#enhancer.testDescription(test.description)}`;
      }
      this.log(`# ${header}`);

      // Handle each assertion
      if (test.assertions.length) {
        let subCount = 0;
        for (const asrt of test.assertions) {
          const text = asrt.message ? `${asrt.text} (${this.#enhancer.failure(asrt.message)})` : asrt.text;
          let subMessage = [
            this.#enhancer.assertNumber(++subCount),
            '-',
            this.#enhancer.assertDescription(text),
            `${this.#enhancer.assertFile(asrt.file.replace(RuntimeIndex.mainModule.sourcePath, '.'))}:${this.#enhancer.assertLine(asrt.line)}`
          ].join(' ');

          if (asrt.error) {
            subMessage = `${this.#enhancer.failure('not ok')} ${subMessage}`;
          } else {
            subMessage = `${this.#enhancer.success('ok')} ${subMessage}`;
          }
          this.log(`    ${subMessage}`);

          if (asrt.message && asrt.message.length > 100) {
            this.logMeta({ message: asrt.message.replace(/\\n/g, '\n') });
          }
        }
        this.log(`    ${this.#enhancer.assertNumber(1)}..${this.#enhancer.assertNumber(subCount)}`);
      }

      // Track test result
      let status = `${this.#enhancer.testNumber(++this.#count)} `;
      switch (test.status) {
        case 'skipped': status += ' # SKIP'; break;
        case 'failed': status = `${this.#enhancer.failure('not ok')} ${status}`; break;
        default: status = `${this.#enhancer.success('ok')} ${status}`;
      }
      status += header;

      this.log(status);

      // Handle error
      if (test.status === 'failed') {
        if (test.error && test.error.name !== 'AssertionError') {
          const err = ErrorUtil.deserializeError(test.error);
          this.logMeta({ error: err instanceof AppError ? err.toJSON() : err });
        }
      }

      // Track output
      if (test.output) {
        for (const key of ['log', 'info', 'error', 'debug', 'warn']) {
          if (test.output[key]) {
            this.logMeta({ [key]: test.output[key] });
          }
        }
      }
    }
  }

  /**
   * Summarize all results
   */
  onSummary(summary: SuitesSummary): void {
    this.log(`${this.#enhancer.testNumber(1)}..${this.#enhancer.testNumber(summary.total)}`);

    if (summary.errors.length) {
      this.log('---\n');
      for (const err of summary.errors) {
        this.log(this.#enhancer.failure(err instanceof AppError ? JSON.stringify(err.toJSON(), null, 2) : `${err}`));
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
      `# (Total Test Time: ${TimeUtil.asClock(summary.duration)}, Total Run Time: ${TimeUtil.asClock(Date.now() - this.#start)})`
    ].join(' '));
  }
}
