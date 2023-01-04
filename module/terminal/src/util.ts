import tty from 'tty';
import timers from 'timers/promises';

import { ColorDefineUtil, RGB, RGBInput } from './color-define';

type Style =
  { text?: RGBInput, background?: RGBInput, italic?: boolean, underline?: boolean, inverse?: boolean, blink?: boolean };

export type StyleInput = Style | RGBInput;
export type TerminalTableEvent = { idx: number, text: string, done?: boolean };
export type TerminalProgressEvent = { idx: number, total?: number, status?: string };
export type TerminalOpConfig = { showCursor?: boolean, interactive?: boolean };
export type TerminalWaitingConfig = TerminalOpConfig & { completion?: string, delay?: number, waitingStates?: string[], rate?: number };
const COLOR_LEVEL_MAP = { 1: 0, 4: 1, 8: 2, 24: 3 } as const;
type ColorBits = keyof (typeof COLOR_LEVEL_MAP);
export type ColorLevel = 0 | 1 | 2 | 3;

const STD_WAIT_STATES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

/**
 * Terminal utilities
 */
export class TerminalUtil {

  static removeAnsiSequences(output: string): string {
    // eslint-disable-next-line no-control-regex
    return output.replace(/(\x1b|\x1B)\[[?]?[0-9;]+[A-Za-z]/g, '');
  }

  /**
   * Detect color level from tty information
   */
  static detectColorLevel(stream: tty.WriteStream): ColorLevel {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return stream.isTTY ? COLOR_LEVEL_MAP[stream.getColorDepth() as ColorBits] : 0;
  }

  /**
   * Detect if stream should be considered interactive
   */
  static detectInteractive(stream: tty.WriteStream): boolean {
    return (stream.isTTY && !/^(true|yes|on|1)$/i.test(process.env.TRV_QUIET ?? ''));
  }

  /**
   * Get styled levels, 0-3
   */
  static getStyledLevels(inp: StyleInput): [string, string][] {
    const cfg = (typeof inp !== 'object') ? { text: inp } : inp;
    const levelPairs: [string, string][] = [['', '']];
    const text = cfg.text ? ColorDefineUtil.getColorCodes(cfg.text, false) : undefined;
    const bg = cfg.background ? ColorDefineUtil.getColorCodes(cfg.background, true) : undefined;

    for (const level of [1, 2, 3]) {
      const prefix: number[] = [];
      const suffix: number[] = [];
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      for (const key of Object.keys(cfg) as (keyof typeof cfg)[]) {
        if (!cfg[key]) {
          continue;
        }
        switch (key) {
          case 'inverse': prefix.push(7); suffix.push(27); break;
          case 'underline': prefix.push(4); suffix.push(24); break;
          case 'italic': prefix.push(3); suffix.push(23); break;
          case 'blink': prefix.push(5); suffix.push(25); break;
          case 'text': prefix.push(...text![level][0]); suffix.push(...text![level][1]); break;
          case 'background': prefix.push(...bg![level][0]); suffix.push(...bg![level][1]); break;
        }
      }
      levelPairs[level] = [`\x1b[${prefix.join(';')}m`, `\x1b[${suffix.reverse().join(';')}m`];
    }
    return levelPairs;
  }

  static async queryCursorPosition(input: tty.ReadStream, stream: tty.WriteStream): Promise<{ x: number, y: number }> {
    const prom = new Promise<{ x: number, y: number }>(res =>
      input.once('readable', () => {
        const buf: Buffer = input.read();
        const { groups = {} } = buf.toString('utf8').match(/(?<r>\d*);(?<c>\d*)/)!;
        res({ x: +(groups.c || 1) - 0, y: +(groups.r ?? 1) - 0 });
      })
    );

    input.setRawMode(true);
    stream.write('\x1b[6n');
    return prom.finally(() => input.setRawMode(false));
  }

  static async queryTerminalColor(input: tty.ReadStream, stream: tty.WriteStream, field: 'text' | 'background'): Promise<RGB> {
    try {
      const prom = new Promise<RGB>(res =>
        input.once('readable', () => {
          const buf: Buffer = input.read();
          const m = buf.toString('utf8').match(/(?<r>[0-9a-f]+)[/](?<g>[0-9a-f]+)[/](?<b>[0-9a-f]+)[/]?(?<a>[0-9a-f]+)?/i)!;
          const groups = m.groups ?? {};
          const width = groups.r.length;
          const [rh, gh, bh] = [groups.r, groups.g, groups.b].map(x => Math.trunc(parseInt(x, 16) / (16 ** (width - 2))));
          res([rh, gh, bh]);
        })
      );
      input.setRawMode(true);
      const code = field === 'text' ? 10 : 11;
      stream.write(`\x1b]${code};?\x1b\\`);
      return await prom;
    } catch (err) {
      const color = process.env.COLORFGBG;
      if (color) {
        const [fg, bg] = color.split(';');
        return ColorDefineUtil.rgbFromAnsi256(
          +(field === 'text' ? fg : bg)
        );
      }
      throw err;
    } finally {
      input.setRawMode(false);
    }
  }

  /**
   * Builds out a waiting indicator
   * @param message
   */
  static async waitingIndicator(
    message: string,
    until: () => boolean,
    render: (text: string, idx: number) => Promise<void>,
    config: TerminalWaitingConfig = {}
  ): Promise<void> {
    await timers.setTimeout(config.delay ?? 1000);
    if (config.interactive) {
      let i = 0;
      const rate = config.rate ?? 50;
      const states = config.waitingStates ?? STD_WAIT_STATES;
      while (!until()) {
        const ch = states[i % states.length];
        await render(i === 0 ? `${ch} ${message}` : ch, i);
        await timers.setTimeout(rate);
        i += 1;
      }
    } else {
      await render(`${message}...`, 0);
    }
  }

  /**
   * Write lines, and track when list of lines grows
   */
  static async trackLinesWithGrowth<T>(
    source: AsyncIterable<T>,
    resolve: (val: T) => TerminalTableEvent,
    render: (ev: TerminalTableEvent) => Promise<void>,
    grow: (delta: number, total: number) => Promise<void>
  ): Promise<number> {
    let maxRow: number = 0;

    for await (const val of source) {
      const ev = resolve(val);
      const dr = ev.idx - maxRow;
      if (dr > 0) {
        await grow(dr, ev.idx + 1);
        maxRow = ev.idx;
      }
      await render(ev);
    }

    return maxRow;
  }

  /**
  * Track progress of an asynchronous iterator, allowing the showing of a progress bar if the stream produces i and total
  * @param stream
  * @param source
  */
  static async trackProgress<T>(
    source: AsyncIterable<T>,
    resolve: (val: T) => TerminalProgressEvent,
    layout: (idx: string, total?: string, status?: string) => string,
    render: (left: string, right?: string) => Promise<void>
  ): Promise<void> {
    let last: number = -1;
    for await (const v of source) {
      if (!v) {
        continue;
      }
      const { idx: i, total, status } = resolve(v);
      if (i > last) {
        last = i;
        if (total) {
          const ts = `${total}`;
          const ip = `${i}`.padStart(ts.length);
          const line = layout(ip, ts, status);
          const pct = Math.trunc(line.length * (i / total));
          await render(line.substring(0, pct), line.substring(pct));
        } else {
          await render(layout(`${i}`, undefined, status));
        }
      }
    }
  }
}