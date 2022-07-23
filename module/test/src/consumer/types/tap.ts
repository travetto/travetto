import { Writable } from 'stream';

import { ColorUtil, PathUtil } from '@travetto/boot';
import { YamlUtil } from '@travetto/yaml';
import { ErrorUtil } from '@travetto/base/src/internal/error';

import { TestEvent } from '../../model/event';
import { SuitesSummary, TestConsumer } from '../types';
import { Consumable } from '../registry';
import { TestResultsEnhancer, COLOR_ENHANCER, DUMMY_ENHANCER } from '../enhancer';

/**
  * TAP Format consumer
 */
@Consumable('tap')
export class TapEmitter implements TestConsumer {
  #count = 0;
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

  /**
   * Preamble
   */
  onStart(): void {
    this.log(this.#enhancer.suiteName('TAP version 13')!);
  }

  /**
   * Output supplemental data (e.g. logs)
   */
  logMeta(obj: Record<string, unknown>): void {
    let body = YamlUtil.serialize(obj, { wordwrap: +(process.env.TRV_CONSOLE_WIDTH ?? process.stdout.columns ?? 80) - 5 });
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
        for (const a of test.assertions) {
          const text = a.message ? `${a.text} (${this.#enhancer.failure(a.message)})` : a.text;
          let subMessage = [
            this.#enhancer.assertNumber(++subCount),
            '-',
            this.#enhancer.assertDescription(text),
            `${this.#enhancer.assertFile(a.file.replace(PathUtil.cwd, '.'))}:${this.#enhancer.assertLine(a.line)}`
          ].join(' ');

          if (a.error) {
            subMessage = `${this.#enhancer.failure('not ok')} ${subMessage}`;
          } else {
            subMessage = `${this.#enhancer.success('ok')} ${subMessage}`;
          }
          this.log(`    ${subMessage}`);

          if (a.message && a.message.length > 100) {
            this.logMeta({ message: a.message.replace(/\\n/g, '\n') });
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
        if (test.error?.stack && !test.error.stack.includes('AssertionError')) {
          const err = ErrorUtil.deserializeError(test.error);
          this.logMeta({ error: err.toJSON?.() ?? err });
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
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        this.log(this.#enhancer.failure(err instanceof Error ? err.toJSON() as string : `${err}`));
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
  }
}
