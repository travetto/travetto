import { Util, AsyncQueue } from '@travetto/runtime';
import { StyleUtil, Terminal, TerminalUtil } from '@travetto/terminal';

import type { TestEvent } from '../../model/event.ts';
import type { TestResult, TestStatus } from '../../model/test.ts';

import type { SuitesSummary, TestConsumerShape, TestRunState } from '../types.ts';
import { TestConsumer } from '../decorator.ts';

import { TapEmitter } from './tap.ts';
import { CONSOLE_ENHANCER, type TestResultsEnhancer } from '../enhancer.ts';
import type { SuiteResult } from '../../model/suite.ts';

type Result = {
  key: string;
  duration: number;
  tests: number;
};

/**
 * Streamed summary results
 */
@TestConsumer()
export class TapSummaryEmitter implements TestConsumerShape {

  #timings = new Map<'test' | 'module' | 'file' | 'suite', Map<string, Result>>();

  #terminal: Terminal;
  #results = new AsyncQueue<TestResult>();
  #progress: Promise<unknown> | undefined;
  #consumer: TapEmitter;
  #enhancer: TestResultsEnhancer;
  #options?: Record<string, unknown>;

  constructor(terminal: Terminal = new Terminal(process.stderr)) {
    this.#terminal = terminal;
    this.#enhancer = CONSOLE_ENHANCER;
    this.#consumer = new TapEmitter(this.#terminal, this.#enhancer);
  }

  #computeTimings(suite: SuiteResult): void {
    const [module] = suite.classId.split(/:/);
    const [file] = suite.classId.split(/#/);

    const testCount = Object.keys(suite.tests).length;

    const foundModule = this.#timings
      .getOrInsert('module', new Map<string, Result>())
      .getOrInsert(module, { key: module, duration: 0, tests: 0 });

    foundModule.duration += suite.duration;
    foundModule.tests += testCount;

    const foundFile = this.#timings
      .getOrInsert('file', new Map<string, Result>())
      .getOrInsert(file, { key: file, duration: 0, tests: 0 });

    foundFile.duration += suite.duration;
    foundFile.tests += testCount;

    this.#timings
      .getOrInsert('suite', new Map<string, Result>())
      .set(suite.classId, {
        key: suite.classId,
        duration: suite.duration,
        tests: testCount
      });
  }

  #renderTimings(): void {
    const count = +(this.#options?.count ?? 5);
    this.#consumer.log('\n---');
    for (const [title, results] of [...this.#timings.entries()].toSorted((a, b) => a[0].localeCompare(b[0]))) {
      this.#consumer.log(`${this.#enhancer.suiteName(`Top ${count} slowest ${title}s`)}: `);
      const top10 = [...results.values()].toSorted((a, b) => b.duration - a.duration).slice(0, count);

      for (const result of top10) {
        console.log(`  * ${this.#enhancer.testName(result.key)} - ${this.#enhancer.total(result.duration)}ms / ${this.#enhancer.total(result.tests)} tests`);
      }
      this.#consumer.log('');
    }
    this.#consumer.log('...');
  }

  setOptions(options?: Record<string, unknown>): Promise<void> | void {
    this.#options = options;
    this.#consumer.setOptions(options);
  }

  async onStart(state: TestRunState): Promise<void> {
    this.#consumer.onStart();
    const total: Record<TestStatus | 'count', number> = { errored: 0, failed: 0, passed: 0, skipped: 0, unknown: 0, count: 0 };
    const success = StyleUtil.getStyle({ text: '#e5e5e5', background: '#026020' }); // White on dark green
    const fail = StyleUtil.getStyle({ text: '#e5e5e5', background: '#8b0000' }); // White on dark red
    this.#progress = this.#terminal.streamToBottom(
      Util.mapAsyncIterable(
        this.#results,
        (value) => {
          total[value.status] += 1;
          total.count += 1;
          const statusLine = `${total.failed} failed, ${total.errored} errored, ${total.skipped} skipped`;
          return { value: `Tests %idx/%total [${statusLine}] -- ${value.classId}`, total: state.testCount, idx: total.count };

        },
        TerminalUtil.progressBarUpdater(this.#terminal, { style: () => ({ complete: (total.failed || total.errored) ? fail : success }) })
      ),
      { minDelay: 100 }
    );
  }

  onEvent(event: TestEvent): void {
    if (event.type === 'test' && event.phase === 'after') {
      const { test } = event;
      this.#results.add(test);
      if (test.status === 'failed') {
        this.#consumer.onEvent(event);
      }
      const tests = this.#timings.getOrInsert('test', new Map<string, Result>());
      tests.set(`${event.test.classId}/${event.test.methodName}`, {
        key: `${event.test.classId}/${event.test.methodName}`,
        duration: test.duration,
        tests: 1
      });
    } else if (event.type === 'suite' && event.phase === 'after') {
      if (this.#options?.timings) {
        this.#computeTimings(event.suite);
      }
    }
  }

  /**
   * Summarize all results
   */
  async onSummary(summary: SuitesSummary): Promise<void> {
    this.#results.close();
    await this.#progress;
    this.#consumer.onSummary?.(summary);

    if (this.#options?.timings) {
      this.#renderTimings();
    }
  }
}
