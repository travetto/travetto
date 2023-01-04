import timers from 'timers/promises';

import { TerminalStream } from './stream';
import { TerminalInteractive, TerminalUtil } from './util';

export type TerminalTableEvent = { idx: number, text: string, done?: boolean };
export type TerminalProgressEvent = { idx: number, total?: number, status?: string };
export type TerminalProgressConfig = TerminalInteractive & { position?: 'bottom' | 'top' | 'inline', initialDelay?: number, cycleDelay?: number };
export type TerminalTableConfig = TerminalInteractive & { header?: string[], forceNonInteractiveOrder?: boolean };

export type TerminalWaitingIndicator = { stream: AsyncIterable<{ idx: number, message: string }>, finish: () => void };

const STD_WAIT_STATES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

/**
 * Complex terminal operations
 */
export class TerminalOperation {

  /**
   * Style a percentage of a line relative to a width
   */
  static stylePercentage(text: string, idx: number, total: number | undefined, width: number, style: (t: string) => string): string {
    text = text.padEnd(width);
    const pct = total === undefined ? 0 : (idx / total);
    const mid = Math.trunc(pct * width);
    const [l, r] = [text.substring(0, mid), text.substring(mid)];
    return `${style(l)}${r}`;
  }

  /**
   * Build a cancelable waiting indicator
   */
  static waitingIndicator(message: string, states: string[] = STD_WAIT_STATES): TerminalWaitingIndicator {
    let done = true;
    async function* stream(): AsyncIterable<{ idx: number, message: string }> {
      let i = 0;
      for (; done; i += 1) {
        const ch = states[i % states.length];
        if (i === 0) {
          yield { idx: i, message: `${ch} ${message}` };
        } else {
          yield { idx: i, message: ch };
        }
      }
      yield { idx: i, message: `${message} Completed` };
    }
    return { stream: stream(), finish: (): void => { done = false; } };
  }

  /**
   * Consumes a stream, of events, tied to specific list indices, and updates in place
   */
  static async makeList(stream: TerminalStream, source: AsyncIterable<TerminalTableEvent>, config: TerminalTableConfig = {}): Promise<void> {
    const { interactive = stream.interactive, forceNonInteractiveOrder: forceOrder } = config;

    await stream.writeLines(config.header ?? []);
    return await TerminalUtil.withDisabledCursor(stream, config, async () => {
      let size: number = 0;

      if (interactive) {
        for await (const { idx, text } of source) {
          const dr = idx - size;
          if (dr > 0) {
            size = idx;
            await TerminalUtil.withRestore(stream, () => stream.write('\n'.repeat(size - 1))); // Fill out table
          }
          await TerminalUtil.withRestore(stream, async () => {
            await stream.moveRelative(0, idx);
            await stream.rewriteLine(text, true);
          });
        }
        await stream.moveRelative(0, size);
        await stream.write('\n');
      } else if (forceOrder) {
        const last: string[] = [];
        for await (const { idx, text } of source) {
          last[idx] = text;
        }
        await stream.writeLines(last);
      } else {
        for await (const { text, done } of source) {
          if (done) {
            await stream.writeLine(text);
          }
        }
      }

      await stream.writeLine();
    });
  }

  /**
  * Run an asynchronous iterator, drawing output in a specific location
  * @param stream
  * @param source
  */
  static async streamToLine<X extends { idx: number }>(
    stream: TerminalStream,
    source: AsyncIterable<X>,
    layout: (item: X) => string,
    config: TerminalProgressConfig = {}
  ): Promise<void> {
    const { interactive = stream.interactive, position = 'inline' } = config;

    // If not interactive, don't force it
    if (!interactive) {
      // Drain events
      for await (const _ of source) { }
      return;
    }

    const writer = TerminalUtil.positionedWriter(stream, position);

    await writer.init();

    const res = TerminalUtil.withDisabledCursor(stream, config, async () => {
      let last: number = -1;
      await timers.setTimeout(config.initialDelay ?? 0);
      for await (const v of source) {
        if (!v) {
          continue;
        }
        if (v.idx > last) {
          last = v.idx;
          await writer.writeLine(layout(v));
        }
        await timers.setTimeout(config.cycleDelay ?? 0);
      }
    });

    return res.finally(() => writer.close());
  }
}