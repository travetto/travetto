import { Util, AsyncQueue } from '@travetto/runtime';
import { StyleUtil, Terminal, TerminalUtil } from '@travetto/terminal';

import type { TestEvent } from '../../model/event';
import type { TestResult } from '../../model/test';

import type { SuitesSummary, TestConsumer, TestRunState } from '../types';
import { Consumable } from '../registry';

import { TapEmitter } from './tap';

type Result = {
  key: string;
  duration: number;
  tests: number;
};

/**
 * Streamed summary results
 */
@Consumable()
export class TapStreamedEmitter implements TestConsumer {

  #timings = new Map([
    ['file', new Map<string, Result>()],
    ['module', new Map<string, Result>()],
    ['suite', new Map<string, Result>()],
    ['test', new Map<string, Result>()],
  ] as const);

  #terminal: Terminal;
  #results = new AsyncQueue<TestResult>();
  #progress: Promise<unknown> | undefined;
  #consumer: TapEmitter;

  constructor(terminal: Terminal = new Terminal(process.stderr)) {
    this.#terminal = terminal;
    this.#consumer = new TapEmitter(this.#terminal);
  }

  async onStart(state: TestRunState): Promise<void> {
    this.#consumer.onStart();

    let failed = 0;
    let skipped = 0;
    let completed = 0;
    const success = StyleUtil.getStyle({ text: '#e5e5e5', background: '#026020' }); // White on dark green
    const fail = StyleUtil.getStyle({ text: '#e5e5e5', background: '#8b0000' }); // White on dark red
    this.#progress = this.#terminal.streamToBottom(
      Util.mapAsyncItr(
        this.#results,
        (value, idx) => {
          failed += (value.status === 'failed' ? 1 : 0);
          skipped += (value.status === 'skipped' ? 1 : 0);
          completed += (value.status !== 'skipped' ? 1 : 0);
          return { value: `Tests %idx/%total [${failed} failed, ${skipped} skipped] -- ${value.classId}`, total: state.testCount, idx: completed };
        },
        TerminalUtil.progressBarUpdater(this.#terminal, { style: () => ({ complete: failed ? fail : success }) })
      ),
      { minDelay: 100 }
    );
  }

  onEvent(ev: TestEvent): void {
    if (ev.type === 'test' && ev.phase === 'after') {
      const { test } = ev;
      this.#results.add(test);
      if (test.status === 'failed') {
        this.#consumer.onEvent(ev);
      }
      const tests = this.#timings.get('test')!;
      tests.set(`${ev.test.classId}/${ev.test.methodName}`, {
        key: `${ev.test.classId}/${ev.test.methodName}`,
        duration: test.duration,
        tests: 1
      });
    } else if (ev.type === 'suite' && ev.phase === 'after') {
      const [module] = ev.suite.classId.split(/:/);
      const [file] = ev.suite.classId.split(/#/);

      const modules = this.#timings.get('module')!;
      const files = this.#timings.get('file')!;
      const suites = this.#timings.get('suite')!;

      if (!modules!.has(module)) {
        modules.set(module, { key: module, duration: 0, tests: 0 });
      }

      if (!files.has(file)) {
        files.set(file, { key: file, duration: 0, tests: 0 });
      }

      suites.set(ev.suite.classId, {
        key: ev.suite.classId,
        duration: ev.suite.duration,
        tests: ev.suite.tests.length
      });

      files.get(file)!.duration += ev.suite.duration;
      files.get(file)!.tests += ev.suite.tests.length;
      modules.get(module)!.duration += ev.suite.duration;
      modules.get(module)!.tests += ev.suite.tests.length;
    }
  }

  /**
   * Summarize all results
   */
  async onSummary(summary: SuitesSummary): Promise<void> {
    this.#results.close();
    await this.#progress;
    await this.#consumer.onSummary?.(summary);

    const enhancer = this.#consumer.enhancer;

    console.log('---');
    for (const [title, results] of [...this.#timings.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`${enhancer.suiteName(`Top 10 slowest ${title}s`)}: `);
      const top10 = [...results.values()].sort((a, b) => b.duration - a.duration).slice(0, 10);
      for (const x of top10) {
        console.log(`  * ${enhancer.testName(x.key)} - ${enhancer.total(x.duration)}ms / ${enhancer.total(x.tests)} tests`);
      }
    }
    console.log('...');
  }
}
