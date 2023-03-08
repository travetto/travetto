import { IterableUtil } from './iterable';
import { TerminalWriter } from './writer';
import { Indexed, TerminalProgressRender, TerminalStreamingConfig, TerminalWaitingConfig, TermState } from './types';
import { ColorOutputUtil, TermStyleInput } from './color-output';

const STD_WAIT_STATES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

export class TerminalOperation {

  /**
   * Allows for writing at top, bottom, or current position while new text is added
   */
  static async streamToPosition(term: TermState, source: AsyncIterable<string>, config: TerminalStreamingConfig = {}): Promise<void> {
    const curPos = config.at ?? { ...await term.getCursorPosition() };
    const pos = config.position ?? 'inline';

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

      let start = Date.now();
      const minDelay = config.minDelay ?? 0;

      const lines: string[] = [];
      for await (const text of source) {
        lines.push(text);
        if ((Date.now() - start) >= minDelay) {
          const next = lines.splice(0, lines.length).pop()!;
          start = Date.now();
          await TerminalWriter.for(term).setPosition(writePos).write(next).clearLine(1).commit(true);
        }
      }

      const last = lines.splice(0, lines.length).pop();
      if (last) {
        await TerminalWriter.for(term).setPosition(writePos).write(last).clearLine(1).commit(true);
      }

      if (config.clearOnFinish ?? true) {
        await TerminalWriter.for(term).setPosition(writePos).clearLine().commit(true);
      }
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
      (ch, i) => config.end ? `${message} ${ch}` : `${ch} ${message}`
    );

    const final = this.streamToPosition(term, indicator, config);
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
        writer = this.streamWaiting(term, msg, { ...cfg, at: pos, clearOnFinish: false });
        line = msg;
      }
    }
    await commitLine();
  }
}