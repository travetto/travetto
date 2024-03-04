import tty from 'node:tty';

import { Env, Util } from '@travetto/base';

import { TerminalWriter } from './writer';

type TerminalStreamingConfig = { minDelay?: number, outputStreamToMain?: boolean };
type Coord = { x: number, y: number };

export const WAIT_TOKEN = '%WAIT%';
const STD_WAIT_STATES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

const lineStatus = (l: string): string => l.replace(WAIT_TOKEN, ' ');
const lineMain = (l: string): string => l.replace(WAIT_TOKEN, '').trim();

/** An basic tty wrapper */
export class Terminal {

  #interactive: boolean;
  #writer: TerminalWriter;
  #width: number;
  #height: number;
  #output: tty.WriteStream;

  async #showWaitingIndicator(pos: Coord, signal: AbortSignal): Promise<void> {
    let done = false;
    signal.addEventListener('abort', () => done = true);
    let i = 0;
    while (!done) {
      await this.#writer.setPosition(pos).write(STD_WAIT_STATES[i++ % STD_WAIT_STATES.length]).commit(true);
      await Util.blockingTimeout(100);
    }
  }

  constructor(output?: tty.WriteStream, config?: { width?: number, height?: number }) {
    this.#output = output ?? process.stdout;
    this.#interactive = this.#output.isTTY && !Env.TRV_QUIET.isTrue;
    this.#width = config?.width ?? (this.#output.isTTY ? this.#output.columns : 120);
    this.#height = config?.height ?? (this.#output.isTTY ? this.#output.rows : 120);
    this.#writer = new TerminalWriter(this);
  }

  get output(): tty.WriteStream { return this.#output; }
  get width(): number { return this.#width; }
  get height(): number { return this.#height; }
  get writer(): TerminalWriter { return this.#writer; }
  get interactive(): boolean { return this.#interactive; }

  /**
   * Stream lines if interactive, with waiting indicator, otherwise print out
   */
  async streamLines(source: AsyncIterable<string | undefined>): Promise<void> {
    if (!this.#interactive) {
      for await (const line of source) {
        if (line !== undefined) {
          await this.#writer.writeLine(`> ${line}`).commit();
        }
      }
    } else {
      await this.streamToBottom(Util.mapAsyncItr(source, x => `%WAIT% ${x}`), { outputStreamToMain: true });
    }
  }

  /**
   * Allows for writing at bottom of screen with scrolling support for main content
   */
  async streamToBottom(source: AsyncIterable<string | undefined>, config: TerminalStreamingConfig = {}): Promise<void> {
    const writePos = { x: 0, y: -1 };
    const minDelay = config.minDelay ?? 0;

    let prev: string | undefined;
    let stop: AbortController | undefined;
    let start = Date.now();

    try {
      await this.#writer.hideCursor()
        .storePosition().scrollRange({ end: -2 }).restorePosition()
        .changePosition({ y: -1 }).write('\n')
        .commit();

      for await (const line of source) {
        // Previous line
        if (prev && config.outputStreamToMain) {
          await this.writer.writeLine(lineMain(prev)).commit();
        }

        if (line && (Date.now() - start) >= minDelay) {
          start = Date.now();
          stop?.abort();
          this.writer.setPosition(writePos).write(lineStatus(line)).clearLine(1).commit(true);

          const idx = line.indexOf(WAIT_TOKEN);
          if (idx >= 0) {
            stop = new AbortController();
            this.#showWaitingIndicator({ y: writePos.y, x: idx }, stop.signal);
          }
        }

        prev = line;
      }

      stop?.abort();
      if (prev !== undefined && config.outputStreamToMain) {
        await this.writer.writeLine(lineMain(prev)).commit();
      }

      await this.#writer.setPosition(writePos).clearLine().commit(true);
    } finally {
      await this.#writer.reset().commit();
    }
  }

  /**
   * Consumes a stream, of events, tied to specific list indices, and updates in place
   */
  async streamList(source: AsyncIterable<{ idx: number, text: string, done?: boolean }>): Promise<void> {
    if (!this.#interactive) {
      const collected = [];
      for await (const ev of source) {
        if (ev.done) {
          collected[ev.idx] = ev.text;
        }
      }
      await this.#writer.writeLines(collected).commit();
      return;
    }

    let max = 0;
    try {
      await this.#writer.hideCursor().commit();
      for await (const { idx, text } of source) {
        max = Math.max(idx, max);
        await this.#writer.write('\n'.repeat(idx)).setPosition({ x: 0 }).write(text).clearLine(1).changePosition({ y: -idx }).commit();
      }
    } finally {
      await this.#writer.changePosition({ y: max + 1 }).writeLine('\n').reset().commit();
    }
  }
}