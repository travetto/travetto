import { stringify } from 'yaml';

import { Terminal } from '@travetto/terminal';
import { TimeUtil, Runtime, RuntimeIndex, hasToJSON } from '@travetto/runtime';

import type { TestEvent } from '../../model/event.ts';
import type { SuitesSummary, TestConsumerShape } from '../types.ts';
import { TestConsumer } from '../registry.ts';
import { SerializeUtil } from '../serialize.ts';
import { TestResultsEnhancer, CONSOLE_ENHANCER } from '../enhancer.ts';

/**
  * TAP Format consumer
 */
@TestConsumer()
export class TapEmitter implements TestConsumerShape {
  #count = 0;
  #enhancer: TestResultsEnhancer;
  #terminal: Terminal;
  #start: number;
  #options?: Record<string, unknown>;

  constructor(
    terminal = new Terminal(),
    enhancer: TestResultsEnhancer = CONSOLE_ENHANCER
  ) {
    this.#terminal = terminal;
    this.#enhancer = enhancer;
  }

  setOptions(options?: Record<string, unknown>): Promise<void> | void {
    this.#options = options;
  }


  log(message: string): void {
    this.#terminal.writer.writeLine(message).commit();
  }

  /**
   * Preamble
   */
  onStart(): void {
    this.#start = Date.now();
    this.log(this.#enhancer.suiteName('TAP version 14')!);
  }

  /**
   * Output supplemental data (e.g. logs)
   */
  logMeta(obj: Record<string, unknown>): void {
    const lineLength = this.#terminal.width - 5;
    let body = stringify(obj, { lineWidth: lineLength, indent: 2 });
    body = body.split('\n').map(x => `  ${x}`).join('\n');
    this.log(`---\n${this.#enhancer.objectInspect(body)}\n...`);
  }

  toError(error?: Error): string | undefined {
    if (error && error.name !== 'AssertionError') {
      const err = SerializeUtil.deserializeError(error);
      if (hasToJSON(err)) {
        const obj = err.toJSON();
        let out = JSON.stringify(obj, null, 2);
        if (this.#options?.verbose && err.stack) {
          out = `${out}\n${err.stack}`;
        }
        return out;
      } else {
        return `${err}`;
      }
    }
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
          const pth = RuntimeIndex.getFromImport(asrt.import)!.sourceFile.replace(Runtime.mainSourcePath, '.');
          let subMessage = [
            this.#enhancer.assertNumber(++subCount),
            '-',
            this.#enhancer.assertDescription(text),
            `${this.#enhancer.assertFile(pth)}:${this.#enhancer.assertLine(asrt.line)}`
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
        const error = this.toError(test.error);
        if (error) {
          this.logMeta({ error });
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
        this.log(this.#enhancer.failure(this.toError(err)!));
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
