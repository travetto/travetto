import timers from 'node:timers/promises';

import { IterableUtil } from './iterable';
import { TerminalWriter } from './writer';
import { TerminalStreamingConfig, TermState } from './types';

type Coord = { x: number, y: number };

const STD_WAIT_STATES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

/**
 * Standard Terminal Operations
 */
export class TerminalOperation {

  /** Write line without wait */
  static async writeWithoutWait(writer: TerminalWriter, l: string, pos?: Coord, sub = ''): Promise<void> {
    let out = l.replace('%WAIT%', sub);
    if (!sub) {
      out = out.trim();
    }
    if (pos) {
      return writer.setPosition(pos).write(out).clearLine(1).commit(true);
    } else {
      return writer.writeLine(out).commit();
    }
  }

  /** Show waiting indicator */
  static async showWaitingIndicator(writer: TerminalWriter, pos: Coord, signal: AbortSignal): Promise<void> {
    let done = false;
    signal.addEventListener('abort', () => done = true);
    let i = 0;
    while (!done) {
      await writer.setPosition(pos).write(STD_WAIT_STATES[i++ % STD_WAIT_STATES.length]).commit(true);
      await timers.setTimeout(100);
    }
  }

  static truncateIfNeeded(term: TermState, text: string, suffix = '...'): string {
    if (text.length > term.width) {
      return `${text.substring(0, term.width - suffix.length)}${suffix}`;
    }
    return text;
  }

  static async writeLinesPlain(term: TermState, source: Iterable<string | undefined> | AsyncIterable<string | undefined>): Promise<void> {
    const writer = TerminalWriter.for(term);
    for await (const line of source) {
      if (line !== undefined) {
        await writer.writeLines([line]).commit();
      }
    }
  }

  /**
   * Allows for writing at top, bottom, or current position while new text is added
   */
  static async streamToPosition(term: TermState, source: AsyncIterable<string | undefined>, config: TerminalStreamingConfig = {}): Promise<void> {
    const writer = TerminalWriter.for(term);
    const writePos = { x: 0, y: -1 };
    const minDelay = config.minDelay ?? 0;

    let prev: string | undefined;
    let stop: AbortController | undefined;
    let start = Date.now();

    try {
      await writer.hideCursor()
        .storePosition().scrollRange({ end: -2 }).restorePosition()
        .changePosition({ y: -1 }).write('\n')
        .commit();

      for await (const line of source) {
        // Previous line
        if (prev && config.outputStreamToMain) {
          await this.writeWithoutWait(writer, prev);
        }

        if (line && (Date.now() - start) >= minDelay) {
          start = Date.now();
          stop?.abort();
          await this.writeWithoutWait(writer, line, writePos, ' ');

          const idx = line.indexOf('%WAIT%');
          if (idx >= 0) {
            stop = new AbortController();
            this.showWaitingIndicator(writer, { y: writePos.y, x: idx }, stop.signal);
          }
        }

        prev = line;
      }

      stop?.abort();
      if (prev !== undefined && config.outputStreamToMain) {
        await this.writeWithoutWait(writer, prev);
      }

      await writer.setPosition(writePos).clearLine().commit(true);
    } finally {
      await writer.softReset().commit();
    }
  }

  /**
   * Consumes a stream, of events, tied to specific list indices, and updates in place
   */
  static async streamList(term: TermState, source: AsyncIterable<{ idx: number, text: string, done?: boolean }>): Promise<void> {
    const writer = TerminalWriter.for(term);

    if (!term.interactive) {
      const isDone = IterableUtil.filter(source, ev => !!ev.done);
      await IterableUtil.drain(IterableUtil.map(isDone, ev => writer.writeLines([ev.text]).commit()));
      return;
    }

    let max = 0;
    try {
      await writer.hideCursor().commit();
      for await (const { idx, text } of source) {
        max = Math.max(idx, max);
        await writer.write('\n'.repeat(idx)).rewriteLine(text).clearLine(1).changePosition({ y: -idx }).commit();
      }
    } finally {
      await writer.changePosition({ y: max + 1 }).writeLine('\n').showCursor().commit();
    }
  }
}