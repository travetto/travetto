import tty from 'tty';

import { ColorDefineUtil, RGB } from './color-define';
import { TerminalStream } from './stream';

type PositionedWriter = {
  init(): Promise<void>;
  writeLine(text: string, clear?: boolean): Promise<void>;
  close(): Promise<void>;
};

export type TerminalInteractive = { showCursor?: boolean, interactive?: boolean };

/**
 * Terminal utilities
 */
export class TerminalUtil {

  static removeAnsiSequences(output: string): string {
    // eslint-disable-next-line no-control-regex
    return output.replace(/(\x1b|\x1B)\[[?]?[0-9;]+[A-Za-z]/g, '');
  }

  /**
   * Build escape sequence
   */
  static styleText(codes: (string | number)[]): string {
    return `\x1b[${codes.join(';')}m`;
  }

  /**
   * Query cursor position
   */
  static async queryCursorPosition(input: tty.ReadStream, stream: TerminalStream): Promise<{ x: number, y: number }> {
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

  /**
   * Query terminal color, somewhat spotty, uses terminal querying and falls back to COLORFGBG env var
   */
  static async queryTerminalColor(input: tty.ReadStream, stream: TerminalStream, field: 'text' | 'background'): Promise<RGB> {
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
   * Run operation, and restore position afterwards
   */
  static async withRestore<T>(stream: TerminalStream, op: () => Promise<T>): Promise<T> {
    try {
      await stream.write('\x1b7');
      return await op();
    } finally {
      await stream.write('\x1b8');
    }
  }

  /**
   * Show/hide cursor for stream
   */
  static async withDisabledCursor<T>(stream: TerminalStream, cfg: TerminalInteractive, op: () => Promise<T>): Promise<T> {
    if (cfg.interactive && stream.interactive && !cfg.showCursor) {
      try {
        await stream.write('\x1B[?25l');
        return await op();
      } finally {
        await stream.write('\x1B[?25h');
      }
    } else {
      return op();
    }
  }

  static async * mapIterable<T, U>(source: AsyncIterable<T>, fn: (val: T) => U): AsyncIterable<U> {
    for await (const el of source) {
      if (el !== undefined) {
        yield fn(el);
      }
    }
  }

  /**
   * Allows for writing at top, bottom, or current position while new text is added
   */
  static positionedWriter(
    stream: TerminalStream,
    pos: 'top' | 'bottom' | 'inline',
  ): PositionedWriter {
    const height = stream.rows;

    let og = { y: 0 };

    const init = async (): Promise<void> => {
      if (pos === 'bottom') {
        await stream.write(`\x1b[1;${height - 1}r`);
      } else if (pos === 'top') {
        await stream.write(`\x1b[2;${height}r`);
      } else {
        og = await TerminalUtil.queryCursorPosition(process.stdin, stream);
        await stream.write('\n'); // Move past line
      }
    };

    const withPosition = (op: () => Promise<void>): Promise<void> => TerminalUtil.withRestore(stream, async () => {
      switch (pos) {
        case 'bottom': await stream.toRow(height - 1); break;
        case 'top': await stream.toRow(0); break;
        case 'inline': await stream.toRow(og.y); break;
      }
      await op();
    });

    const writeLine = (text: string): Promise<void> => withPosition(() => stream.write(text));

    const close = async (): Promise<void> => {
      await withPosition(() => stream.clear());

      switch (pos) {
        case 'bottom':
        case 'top': await TerminalUtil.withRestore(stream, () => stream.write('\x1b[r')); break;
      }
    };

    return { init, writeLine, close };
  }

}