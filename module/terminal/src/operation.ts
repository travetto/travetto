import { IterableUtil } from './iterable';
import { TerminalWriter } from './writer';
import { Indexed, TerminalStreamingConfig, TerminalWaitingConfig, TermState } from './types';

const STD_WAIT_STATES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

/**
 * Standard Terminal Operations
 */
export class TerminalOperation {

  static truncateIfNeeded(term: TermState, text: string, suffix = '...'): string {
    if (text.length > term.width) {
      return `${text.substring(0, term.width - suffix.length)}${suffix}`;
    }
    return text;
  }

  static async writeLinesPlain(term: TermState, source: Iterable<string | undefined> | AsyncIterable<string | undefined>, map?: (text: string) => string): Promise<void> {
    const writer = TerminalWriter.for(term);
    for await (const line of source) {
      const text = (map && line !== undefined) ? map(line) : line;
      if (text !== undefined) {
        await writer.writeLines([text]);
      }
    }
  }

  /**
   * Allows for writing at top, bottom, or current position while new text is added
   */
  static async streamToPosition(term: TermState, source: AsyncIterable<string>, config: TerminalStreamingConfig = {}): Promise<void> {
    const curPos = config.at ?? { ...await term.getCursorPosition() };
    const pos = config.position ?? 'inline';
    const writer = TerminalWriter.for(term);

    const writePos = pos === 'inline' ?
      { ...curPos, x: 0 } :
      { x: 0, y: pos === 'top' ? 0 : -1 };

    try {
      const batch = writer.hideCursor();
      if (pos !== 'inline') {
        batch.storePosition().scrollRange(pos === 'top' ? { start: 2 } : { end: -2 }).restorePosition();
        if (pos === 'top' && curPos.y === 0) {
          batch.changePosition({ y: 1 }).write('');
        } else if (pos === 'bottom' && curPos.y === term.height - 1) {
          batch.changePosition({ y: -1 }).write('\n');
        }
      } else {
        batch.write('\n'); // Move past line
      }
      await batch.commit();

      let start = Date.now();
      const minDelay = config.minDelay ?? 0;

      let line: string = '';
      for await (const text of source) {
        line = text;
        if ((Date.now() - start) >= minDelay) {
          start = Date.now();
          await writer.setPosition(writePos).write(line).clearLine(1).commit(true);
          line = '';
        }
      }

      if (line) {
        await writer.setPosition(writePos).write(line).clearLine(1).commit(true);
      }

      if (config.clearOnFinish ?? true) {
        await writer.setPosition(writePos).clearLine().commit(true);
      }
    } finally {
      const finalCursor = await term.getCursorPosition();
      await writer.scrollRangeClear().setPosition(finalCursor).showCursor().commit();
    }
  }

  static async streamListPlain(term: TermState, source: AsyncIterable<Indexed & { text: string, done?: boolean }>): Promise<void> {
    const isDone = IterableUtil.filter(source, ev => !!ev.done);
    const writer = TerminalWriter.for(term);
    if (!process.stdout.isTTY) {
      await writer.writeLines([...(await IterableUtil.drain(isDone)).map(x => x.text), '']).commit();
    } else {
      await IterableUtil.drain(IterableUtil.map(isDone, ev => writer.writeLines([ev.text]).commit()));
    }
  }

  /**
   * Consumes a stream, of events, tied to specific list indices, and updates in place
   */
  static async streamList(term: TermState, source: AsyncIterable<Indexed & { text: string }>): Promise<void> {
    let max = 0;
    const writer = TerminalWriter.for(term);
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

  /**
   * Waiting indicator, streamed to a specific position, can be canceled
   */
  static streamWaiting(term: TermState, message: string, config: TerminalWaitingConfig = {}): () => Promise<void> {
    const { stop, stream } = IterableUtil.cycle(STD_WAIT_STATES);
    const indicator = IterableUtil.map(
      stream,
      IterableUtil.DELAY(config),
      (ch, i) => config.end ? `${message} ${ch}` : `${ch} ${message}`
    );

    const final = this.streamToPosition(term, indicator, config);
    return async () => { stop(); return final; };
  }

  /**
   * Stream lines with a waiting indicator
   */
  static async streamLinesWithWaiting(term: TermState, lines: AsyncIterable<string | undefined>, cfg: TerminalWaitingConfig = {}): Promise<void> {
    let writer: (() => Promise<unknown>) | undefined;
    let line: string | undefined;

    let pos = await term.getCursorPosition();


    const commitLine = async (): Promise<void> => {
      await writer?.();
      if (line) {
        const msg = cfg.committedPrefix ? `${cfg.committedPrefix} ${line}` : line;
        if (cfg.position === 'inline') {
          await TerminalWriter.for(term).setPosition(pos).write(msg).commit(true);
        } else {
          await TerminalWriter.for(term).writeLine(msg).commit();
        }
        line = undefined;
      }
    };

    for await (let msg of lines) {
      await commitLine();
      if (msg !== undefined) {
        msg = msg.replace(/\n$/, '');
        pos = await term.getCursorPosition();
        writer = this.streamWaiting(term, this.truncateIfNeeded(term, msg), { ...cfg, at: pos, clearOnFinish: false });
        line = msg;
      }
    }
    await commitLine();
  }
}