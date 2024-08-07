import { Util } from '@travetto/runtime';
import { StyleUtil, Terminal, TerminalUtil } from '@travetto/terminal';
import { WorkQueue } from '@travetto/worker';

import { TestEvent } from '../../model/event';
import { TestResult } from '../../model/test';

import { SuitesSummary, TestConsumer, TestRunState } from '../types';
import { Consumable } from '../registry';

import { TapEmitter } from './tap';

/**
 * Streamed summary results
 */
@Consumable('tap-streamed')
export class TapStreamedEmitter implements TestConsumer {

  #terminal: Terminal;
  #results = new WorkQueue<TestResult>();
  #progress: Promise<unknown> | undefined;
  #consumer: TapEmitter;

  constructor(terminal: Terminal = new Terminal(process.stderr)) {
    this.#terminal = terminal;
    this.#consumer = new TapEmitter(this.#terminal);
  }

  async onStart(state: TestRunState): Promise<void> {
    this.#consumer.onStart();

    let failed = 0;
    const succ = StyleUtil.getStyle({ text: '#e5e5e5', background: '#026020' }); // White on dark green
    const fail = StyleUtil.getStyle({ text: '#e5e5e5', background: '#8b0000' }); // White on dark red
    this.#progress = this.#terminal.streamToBottom(
      Util.mapAsyncItr(
        this.#results,
        (value, idx) => {
          failed += (value.status === 'failed' ? 1 : 0);
          return { value: `Tests %idx/%total [${failed} failed] -- ${value.classId}`, total: state.testCount, idx };
        },
        TerminalUtil.progressBarUpdater(this.#terminal, { style: () => ({ complete: failed ? fail : succ }) })
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
    }
  }

  /**
   * Summarize all results
   */
  async onSummary(summary: SuitesSummary): Promise<void> {
    this.#results.close();
    await this.#progress;
    await this.#consumer.onSummary?.(summary);
  }
}
