import tty from 'node:tty';

import { IterableUtil, MapFn } from './iterable';
import {
  TerminalTableConfig, TerminalTableEvent,
  TerminalWaitingConfig, TermLinePosition, TermState, TermCoord
} from './types';
import { TerminalOperation } from './operation';
import { TerminalQuerier } from './query';
import { TerminalWriter } from './writer';

type TerminalStreamPositionConfig = {
  position?: TermLinePosition;
  staticMessage?: string;
  minDelay?: number;
};

/**
 * An enhanced tty write stream
 */
export class Terminal implements TermState {

  #output: tty.WriteStream;
  #input: tty.ReadStream;
  #interactive: boolean;
  #width?: number;
  #query: TerminalQuerier;

  constructor(config: Partial<TermState>) {
    this.#output = config.output ?? process.stdout;
    this.#input = config.input ?? process.stdin;
    this.#interactive = config.interactive ?? (this.#output.isTTY && !/^(true|yes|on|1)$/i.test(process.env.TRV_QUIET ?? ''));
    this.#width = config.width;
    this.#query = TerminalQuerier.for(this.#input, this.#output);
    process.on('exit', () => this.reset());
  }

  get output(): tty.WriteStream {
    return this.#output;
  }

  get input(): tty.ReadStream {
    return this.#input;
  }

  get interactive(): boolean {
    return this.#interactive;
  }

  get width(): number {
    return this.#width ?? (this.#output.isTTY ? this.#output.columns : 120);
  }

  get height(): number {
    return (this.#output.isTTY ? this.#output.rows : 120);
  }

  writer(): TerminalWriter {
    return TerminalWriter.for(this);
  }

  async writeLines(...text: string[]): Promise<void> {
    return this.writer().writeLines(text, this.interactive).commit();
  }

  reset(): void {
    this.#query.close();
    if (this.interactive) {
      this.#output.write(this.writer().resetCommands());
    }
  }

  getCursorPosition(): Promise<TermCoord> {
    return this.#query.cursorPosition();
  }

  /**
   * Stream line output, showing a waiting indicator for each line until the next one occurs
   *
   * @param lines
   * @param config
   * @returns
   */
  async streamLinesWithWaiting(lines: AsyncIterable<string | undefined>, config: TerminalWaitingConfig): Promise<void> {
    if (!this.interactive) {
      for await (const line of lines) {
        if (line !== undefined) {
          const out = config.committedPrefix ? `${config.committedPrefix} ${line}` : line;
          await this.writeLines(out);
        }
      }
    } else {
      return TerminalOperation.streamLinesWithWaiting(this, lines, { position: 'bottom', ...config });
    }
  }

  /**
   * Consumes a stream, of events, tied to specific list indices, and updates in place
   */
  async streamList<T>(source: AsyncIterable<T>, resolve: MapFn<T, TerminalTableEvent>, config: TerminalTableConfig = {}): Promise<void> {
    const resolved = IterableUtil.map(source, resolve);

    await this.writeLines(...(config.header ?? []));

    if (!this.interactive) {
      const isDone = IterableUtil.filter(resolved, ev => !!ev.done);
      if (config.forceNonInteractiveOrder) {
        await this.writeLines(...(await IterableUtil.drain(isDone)).map(x => x.text), '');
      } else {
        await IterableUtil.drain(IterableUtil.map(isDone, ev => this.writeLines(ev.text)));
        await this.writeLines('');
      }
      return;
    }

    await TerminalOperation.streamList(this, resolved);
  }

  /**
   * Streams an iterable to a specific location, with support for non-interactive ttys
   */
  async streamToPosition<T>(source: AsyncIterable<T>, resolve: MapFn<T, string>, config?: TerminalStreamPositionConfig): Promise<void> {
    if (!this.interactive) {
      if (config?.staticMessage) {
        await this.writeLines(config.staticMessage);
      }
      await IterableUtil.drain(source);
      return;
    }
    return TerminalOperation.streamToPosition(this, IterableUtil.map(source, resolve), config);
  }
}

export const GlobalTerminal = new Terminal({ output: process.stdout });