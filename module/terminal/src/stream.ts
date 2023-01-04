import tty from 'tty';
import readline from 'readline/promises';

/**
 * A packaging of a tty WriteStream, accompanying readline.Readline, and env overrides for width
 */
export class TerminalStream {

  #stream: tty.WriteStream;
  #interactive: boolean;
  #width?: number;
  #readline: readline.Readline;

  constructor(stream: tty.WriteStream, interactive?: boolean, width?: number) {
    this.#stream = stream;
    this.#interactive = interactive ?? (stream.isTTY && !/^(true|yes|on|1)$/i.test(process.env.TRV_QUIET ?? ''));
    this.#width = width;
    this.#readline = new readline.Readline(this.#stream);
  }

  get interactive(): boolean {
    return this.#interactive;
  }

  get columns(): number {
    return this.#width ?? (this.#stream.isTTY ? this.#stream.columns : 120);
  }

  get rows(): number {
    return (this.#stream.isTTY ? this.#stream.rows : 120);
  }

  async write(text: string): Promise<void> {
    if (text) {
      await new Promise(r => this.#stream.write(text, r));
    }
  }

  /**
  * Rewrite a single line in the stream
  * @param text Text, if desired
  * @param clear Should the entire line be cleared?
  */
  async rewriteLine(text: string, clear?: boolean): Promise<void> {
    if (clear) {
      await this.clear();
    }
    if (text) {
      await this.#readline.cursorTo(0).commit();
      await this.write(text);
    }
  }

  toRow(row: number): Promise<void> {
    return this.#readline.cursorTo(0, row).commit();
  }

  moveRelative(dx: number, dy: number = 0): Promise<void> {
    return this.#readline.moveCursor(dx, dy).commit();
  }

  clear(): Promise<void> {
    return this.#readline.clearLine(0).commit();
  }

  async writeLines(lines: string[]): Promise<void> {
    for (const line of lines) {
      await this.writeLine(line);
    }
  }

  writeLine(line: string = ''): Promise<void> {
    return this.write(`${line}\n`);
  }
}