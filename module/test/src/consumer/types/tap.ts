import path from 'node:path';
import { stringify } from 'yaml';

import { Terminal, StyleUtil } from '@travetto/terminal';
import { TimeUtil, RuntimeIndex, hasToJSON, JSONUtil } from '@travetto/runtime';

import type { TestEvent } from '../../model/event.ts';
import type { SuitesSummary, TestConsumerShape } from '../types.ts';
import { TestConsumer } from '../decorator.ts';
import { type TestResultsEnhancer, CONSOLE_ENHANCER } from '../enhancer.ts';

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
    this.log(this.#enhancer.suiteName('TAP version 14'));
  }

  /**
   * Output supplemental data (e.g. logs)
   */
  logMeta(metadata: Record<string, unknown>): void {
    const lineLength = this.#terminal.width - 5;
    let body = stringify(metadata, { lineWidth: lineLength, indent: 2 });
    body = body.split('\n').map(line => `  ${line}`).join('\n');
    this.log(`---\n${this.#enhancer.objectInspect(body)}\n...`);
  }

  /**
   * Error to string
   * @param error
   */
  errorToString(error?: Error): string | undefined {
    if (error && error.name !== 'AssertionError') {
      if (error instanceof Error) {
        let out = JSONUtil.toUTF8(hasToJSON(error) ? error.toJSON() : error, { indent: 2 });
        if (this.#options?.verbose && error.stack) {
          out = `${out}\n${error.stack}`;
        }
        return out;
      } else {
        return `${error}`;
      }
    }
  }

  /**
   * Listen for each event
   */
  onEvent(event: TestEvent): void {
    if (event.type === 'test' && event.phase === 'after') {
      const { test } = event;
      const suiteId = this.#enhancer.suiteName(test.classId);
      const sourceFile = RuntimeIndex.getFromImport(test.import)!.sourceFile;
      const testSourceFile = test.sourceImport ? RuntimeIndex.getFromImport(test.sourceImport)!.sourceFile : sourceFile;

      const header = [
        StyleUtil.link(suiteId, `file://${sourceFile}`),
        ' - ',
        StyleUtil.link(this.#enhancer.testName(test.methodName), `file://${testSourceFile}#${test.lineBodyStart}`),
        ...test.description ? [`: ${this.#enhancer.testDescription(test.description)}`] : []
      ].join('');

      this.log(`# ${header}`);

      // Handle each assertion
      if (test.assertions.length) {
        let subCount = 0;
        for (const asrt of test.assertions) {
          const assertSourceFile = RuntimeIndex.getFromImport(asrt.import)!.sourceFile;
          const text = asrt.message ? `${asrt.text} (${this.#enhancer.failure(asrt.message)})` : asrt.text;
          const location = asrt.import ? `./${path.relative(process.cwd(), assertSourceFile)}` : '<unknown>';
          let subMessage = [
            this.#enhancer.assertNumber(++subCount),
            '-',
            this.#enhancer.assertDescription(text),
            StyleUtil.link(
              `${this.#enhancer.assertFile(location)}:${this.#enhancer.assertLine(asrt.line)}`,
              `file://${assertSourceFile}#${asrt.line}`
            )
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
      switch (test.status) {
        case 'errored':
        case 'failed': {
          if (test.error) {
            const msg = this.errorToString(test.error);
            if (msg) {
              this.logMeta({ error: msg });
            }
          }
          break;
        }
      }

      // Track output
      if (test.output) {
        const groupedByLevel: Record<string, string[]> = {};
        for (const log of test.output) {
          (groupedByLevel[log.level] ??= []).push(log.message);
        }
        for (const key of ['log', 'info', 'error', 'debug', 'warn']) {
          if (groupedByLevel[key]) {
            this.logMeta({ [key]: groupedByLevel[key].join('\n') });
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
      for (const error of summary.errors) {
        const msg = this.errorToString(error);
        if (msg) {
          this.log(this.#enhancer.failure(msg));
        }
      }
    }

    const allPassed = !summary.failed && !summary.errored;

    this.log([
      this.#enhancer[allPassed ? 'success' : 'failure']('Results'),
      `${this.#enhancer.total(summary.passed)}/${this.#enhancer.total(summary.total)},`,
      allPassed ? 'failed' : this.#enhancer.failure('failed'),
      `${this.#enhancer.total(summary.failed)}`,
      allPassed ? 'errored' : this.#enhancer.failure('errored'),
      `${this.#enhancer.total(summary.errored)}`,
      'skipped',
      this.#enhancer.total(summary.skipped),
      `# (Total Test Time: ${TimeUtil.asClock(summary.duration)}, Total Run Time: ${TimeUtil.asClock(Date.now() - this.#start)})`
    ].join(' '));
  }
}
