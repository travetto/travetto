import path from 'node:path';
import { AssertionError } from 'node:assert';
import { stringify } from 'yaml';

import { Terminal, StyleUtil } from '@travetto/terminal';
import { TimeUtil, RuntimeIndex } from '@travetto/runtime';

import type { TestEvent } from '../../model/event.ts';
import type { SuitesSummary, TestConsumerShape } from '../types.ts';
import { TestConsumer } from '../decorator.ts';
import { type TestResultsEnhancer, CONSOLE_ENHANCER } from '../enhancer.ts';

const SPACE = ' ';

/**
 * TAP Format consumer
 */
@TestConsumer()
export class TapEmitter implements TestConsumerShape {
  #count = 0;
  #enhancer: TestResultsEnhancer;
  #terminal: Terminal;
  #options?: Record<string, unknown>;
  #start: number = 0;

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
    if (error instanceof AssertionError) {
      return;
    } else if (error instanceof Error) {
      return error.stack ?
        error.stack.split(/\n/).slice(0, this.#options?.verbose ? -1 : 5).join('\n') :
        error.message;
    } else {
      return `${error}`;
    }
  }

  /**
   * Listen for each event
   */
  onEvent(event: TestEvent): void {
    if (event.type === 'test' && event.phase === 'after') {
      const { test } = event;
      const suiteId = this.#enhancer.suiteName(test.classId);
      const suiteSourceFile = RuntimeIndex.getFromImport(test.import)!.sourceFile;
      const testSourceFile = test.declarationImport ? RuntimeIndex.getFromImport(test.declarationImport)!.sourceFile : suiteSourceFile;

      const header = [
        StyleUtil.link(suiteId, `file://${suiteSourceFile}#${test.suiteLineStart ?? 1}`),
        ' - ',
        StyleUtil.link(this.#enhancer.testName(test.methodName), `file://${testSourceFile}#${test.lineStart}`),
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
        case 'passed': `${this.#enhancer.success('ok')} ${status}`; break;
        case 'skipped': status += ' # SKIP'; break;
        case 'unknown': break;
        default: status = `${this.#enhancer.failure('not ok')} ${status}`; break;
      }
      status += header;

      this.log(status);

      // Handle error
      switch (test.status) {
        case 'errored':
        case 'failed': {
          if (test.error) {
            const message = this.errorToString(test.error);
            if (message) {
              this.logMeta({ error: message });
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

    const allPassed = !summary.failed && !summary.errored;

    this.log([
      this.#enhancer[allPassed ? 'success' : 'failure']('Results'), SPACE,
      `${this.#enhancer.total(summary.passed)}/${this.#enhancer.total(summary.total)},`, SPACE,
      allPassed ? 'failed' : this.#enhancer.failure('failed'), SPACE,
      `${this.#enhancer.total(summary.failed)}`, SPACE,
      allPassed ? 'errored' : this.#enhancer.failure('errored'), SPACE,
      `${this.#enhancer.total(summary.errored)}`, SPACE,
      'skipped', SPACE,
      this.#enhancer.total(summary.skipped), SPACE,
      '#', SPACE, '(Timings:', SPACE,
      'Self=', TimeUtil.asClock(summary.selfDuration), ',', SPACE,
      'Total=', TimeUtil.asClock(summary.duration), ',', SPACE,
      'Clock=', TimeUtil.asClock(Date.now() - this.#start),
      ')',
    ].join(''));
  }
}
