import { IterableUtil } from './iterable';
import { TerminalWriter } from './writer';
import { Indexed, TerminalProgressRender, TerminalWaitingConfig, TermLinePosition, TermState } from './types';
import { ColorOutputUtil, TermStyleInput } from './color-output';

const STD_WAIT_STATES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

export class TerminalOperation {

  /**
   * Allows for writing at top, bottom, or current position while new text is added
   */
  static async streamToPosition(term: TermState, source: AsyncIterable<string>, pos: TermLinePosition = 'inline'): Promise<void> {
    const curPos = { ...await term.getCursorPosition() };
    const writePos = pos === 'inline' ?
      { ...curPos, x: 0 } :
      { x: 0, y: pos === 'top' ? 0 : -1 };

    try {
      const batch = TerminalWriter.for(term).hideCursor();
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

      for await (const text of source) {
        await TerminalWriter.for(term).setPosition(writePos).write(text).clearLine(1).commit(true);
      }
      await TerminalWriter.for(term).setPosition(writePos).clearLine().commit(true);
    } finally {
      const finalCursor = await term.getCursorPosition();
      await TerminalWriter.for(term).scrollRangeClear().setPosition(finalCursor).showCursor().commit();
    }
  }

  /**
   * Consumes a stream, of events, tied to specific list indices, and updates in place
   */
  static async streamList(term: TermState, source: AsyncIterable<Indexed & { text: string }>): Promise<void> {
    let max = 0;
    try {
      await TerminalWriter.for(term).hideCursor().commit();
      for await (const { idx, text } of source) {
        max = Math.max(idx, max);
        await TerminalWriter.for(term).write('\n'.repeat(idx)).rewriteLine(text).clearLine(1).changePosition({ y: -idx }).commit();
      }
    } finally {
      await TerminalWriter.for(term).changePosition({ y: max + 1 }).writeLine('\n').showCursor().commit();
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
      (ch, i) => config.end ? `${message} ${ch}` : (i === 0 ? `${ch} ${message}` : ch)
    );

    const final = this.streamToPosition(term, indicator, config.position ?? 'inline');
    return async () => { stop(); return final; };
  }

  /**
   * Build progress par formatter for terminal progress events
   */
  static buildProgressBar(term: TermState, style: TermStyleInput): TerminalProgressRender {
    const color = ColorOutputUtil.colorer(term, style);
    return ({ total, idx, text }): string => {
      text ||= total ? '%idx/%total' : '%idx';

      const totalStr = `${total ?? ''}`;
      const idxStr = `${idx}`.padStart(totalStr.length);
      const pct = total === undefined ? 0 : (idx / total);
      const line = text
        .replace(/%idx/, idxStr)
        .replace(/%total/, totalStr)
        .replace(/%pct/, `${Math.trunc(pct * 100)}`);
      const full = ` ${line}`.padEnd(term.width);
      const mid = Math.trunc(pct * term.width);
      const [l, r] = [full.substring(0, mid), full.substring(mid)];
      return `${color(l)}${r}`;
    };
  }

  /**
   * Stream lines with a waiting indicator
   */
  static async streamLinesWithWaiting(term: TermState, lines: AsyncIterable<string>, cfg: TerminalWaitingConfig = {}): Promise<void> {
    let writer: (() => Promise<unknown>) | undefined;
    let line: string | undefined;

    const commitLine = async (): Promise<void> => {
      await writer?.();
      if (line) {
        const msg = `${String.fromCharCode(171)} ${line}`;
        if (cfg.position === 'inline') {
          await TerminalWriter.for(term).setPosition({ x: 0 }).changePosition({ y: -1 }).writeLine(msg).commit();
        } else {
          await TerminalWriter.for(term).writeLine(msg).commit();
        }
      }
    };

    for await (let msg of lines) {
      await commitLine();
      msg = msg.replace(/\n$/, '');
      writer = this.streamWaiting(term, msg, cfg);
      line = msg;
    }
    await commitLine();
  }
}