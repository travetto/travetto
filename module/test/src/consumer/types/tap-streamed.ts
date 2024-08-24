import { Util, AsyncQueue } from '@travetto/runtime';
import { StyleUtil, Terminal, TerminalUtil } from '@travetto/terminal';

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
