import tty from 'tty';

import { ObjectUtil } from '@travetto/base';
import { Terminal } from '@travetto/terminal';
import { ManualAsyncIterator } from '@travetto/worker';
import { RootIndex } from '@travetto/manifest';

import { SuitesSummary, TestConsumer } from '../types';
import { Consumable } from '../registry';

import { TestResultsEnhancer, CONSOLE_ENHANCER } from '../enhancer';
import { TestEvent } from '../../model/event';
import { TestResult } from '../../model/test';
import { SuiteRegistry } from '../../registry/suite';

/**
 * Streamed summary results
 */
@Consumable('streamed')
export class StreamedEmitter implements TestConsumer {

  #terminal: Terminal;
  #enhancer: TestResultsEnhancer;
  #results = new ManualAsyncIterator<TestResult>();
  #progress: Promise<unknown> | undefined;

  constructor(
    stream: tty.WriteStream = process.stdout,
    enhancer: TestResultsEnhancer = CONSOLE_ENHANCER
  ) {
    this.#terminal = new Terminal(stream);
    this.#enhancer = enhancer;
  }

  protected log(message: string): void {
    this.#terminal.lines(message);
  }

  async onStart(files: string[]): Promise<void> {
    let i = 0;
    // Load all tests
    for (const file of files) {
      await import(RootIndex.getFromSource(file)!.import);
    }

    await SuiteRegistry.init();

    const suites = SuiteRegistry.getClasses();
    const total = suites
      .map(c => SuiteRegistry.get(c))
      .filter(c => !RootIndex.getFunctionMetadata(c.class)?.abstract)
      .reduce((acc, c) => acc + (c.tests?.length ?? 0), 0);

    this.#progress = this.#terminal.trackProgress('Tests', this.#results, res => ({
      idx: i += 1,
      total,
      status: `${res.classId}#${res.methodName}`,
    }), { position: 'bottom' });

    this.#terminal.lines('');
  }

  onEvent(ev: TestEvent): void {
    if (ev.type === 'test' && ev.phase === 'after') {
      const { test } = ev;
      this.#results.add(test);
      if (test.status === 'failed') {
        this.#terminal.lines(`Test ${test.classId}:${test.methodName}`);
        for (const assert of (test.assertions ?? [])) {
          if (assert.error) {
            this.#terminal.lines(
              `${assert.classId}:${assert.line} => ${assert.text}`,
              assert.error.stack ?? ''
            );
          } else {
            this.#terminal.lines(`${assert.classId}:${assert.line} => ${assert.text}`, '');
          }
        }
      }
    }
  }

  /**
   * Summarize all results
   */
  async onSummary(summary: SuitesSummary): Promise<void> {
    this.#results.close();
    await this.#progress;

    this.log(`${this.#enhancer.testNumber(1)}..${this.#enhancer.testNumber(summary.total)}`);

    if (summary.errors.length) {
      this.log('---\n');
      for (const err of summary.errors) {
        this.log(this.#enhancer.failure(ObjectUtil.hasToJSON(err) ? `${err.toJSON()}` : `${err}`));
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
