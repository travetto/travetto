import { ColorOutputUtil, StyleInput, Terminal } from '@travetto/terminal';
import { ManualAsyncIterator } from '@travetto/worker';
import { RootIndex } from '@travetto/manifest';

import { SuitesSummary, TestConsumer } from '../types';
import { Consumable } from '../registry';

import { TestEvent } from '../../model/event';
import { TestResult } from '../../model/test';
import { SuiteRegistry } from '../../registry/suite';
import { TapEmitter } from './tap';

/**
 * Streamed summary results
 */
@Consumable('tap-streamed')
export class TapStreamedEmitter implements TestConsumer {

  static makeProgressBar(term: Terminal, total: number): (t: TestResult, idx: number) => string {
    let failed = 0;
    const palette: StyleInput[] = [
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
  #results = new ManualAsyncIterator<TestResult>();
  #progress: Promise<unknown> | undefined;
  #consumer: TapEmitter;

  constructor(terminal: Terminal = new Terminal(process.stderr)) {
    this.#terminal = terminal;
    this.#consumer = new TapEmitter(this.#terminal);
  }

  async onStart(files: string[]): Promise<void> {
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

    this.#progress = this.#terminal.streamToPosition(this.#results,
      TapStreamedEmitter.makeProgressBar(this.#terminal, total),
      { position: 'bottom' }
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
