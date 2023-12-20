import { ColorOutputUtil, IterableUtil, TermStyleInput, Terminal, TerminalOperation } from '@travetto/terminal';
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

  static makeProgressBar(term: Terminal, total: number): (t: TestResult, idx: number) => string {
    let failed = 0;
    const palette: TermStyleInput[] = [
      { text: 'white', background: 'darkGreen' },
      { text: 'white', background: 'darkRed' }
    ];
    const styles = palette.map(s => ColorOutputUtil.colorer(s));

    return (t: TestResult, idx: number): string => {
      if (t.status === 'failed') {
        failed += 1;
      }
      const i = idx + 1;
      const digits = total.toString().length;
      const paddedI = `${i}`.padStart(digits);
      const paddedFailed = `${failed}`.padStart(digits);
      const line = `Tests ${paddedI}/${total} [${paddedFailed} failed] -- ${t.classId}`.padEnd(term.width);
      const pos = Math.trunc(line.length * (i / total));
      const colorer = styles[Math.min(failed, styles.length - 1)];
      return `${colorer(line.substring(0, pos))}${line.substring(pos)}`;
    };
  }

  #terminal: Terminal;
  #results = new WorkQueue<TestResult>();
  #progress: Promise<unknown> | undefined;
  #consumer: TapEmitter;

  constructor(terminal: Terminal = new Terminal({ output: process.stderr })) {
    this.#terminal = terminal;
    this.#consumer = new TapEmitter(this.#terminal);
  }

  async onStart(state: TestRunState): Promise<void> {
    this.#consumer.onStart();

    this.#progress = TerminalOperation.streamToPosition(
      this.#terminal,
      IterableUtil.map(this.#results, TapStreamedEmitter.makeProgressBar(this.#terminal, state.testCount ?? 0)),
      { position: 'bottom', minDelay: 100 }
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
