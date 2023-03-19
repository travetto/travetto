import { RootIndex } from '@travetto/manifest';
import { GlobalTerminal, Terminal } from '@travetto/terminal';
import { ErrorUtil, ObjectUtil, TimeUtil } from '@travetto/base';
import { YamlUtil } from '@travetto/yaml';

import { TestEvent } from '../../model/event';
import { SuitesSummary, TestConsumer } from '../types';
import { Consumable } from '../registry';
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
    terminal = new Terminal({ output: process.stdout }),
    enhancer: TestResultsEnhancer = CONSOLE_ENHANCER
  ) {
    this.#terminal = terminal;
    this.#enhancer = enhancer;
  }

  log(message: string): void {
    this.#terminal.writeLines(message);
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
    const lineLength = GlobalTerminal.width - 5;
    let body = YamlUtil.serialize(obj, { wordwrap: lineLength });
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
            `${this.#enhancer.assertFile(asrt.file.replace(RootIndex.mainModule.sourcePath, '.'))}:${this.#enhancer.assertLine(asrt.line)}`
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
        if (test.error?.stack && !test.error.stack.includes('AssertionError')) {
          const err = ErrorUtil.deserializeError(test.error);
          this.logMeta({ error: ObjectUtil.hasToJSON(err) ? err.toJSON() : err });
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
        this.log(this.#enhancer.failure(ObjectUtil.hasToJSON(err) ? err.toJSON() as string : `${err}`));
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
      `# (Total Test Time: ${TimeUtil.prettyDelta(summary.duration)}, Total Run Time: ${TimeUtil.prettyDeltaSinceTime(this.#start)})`
    ].join(' '));
  }
}
