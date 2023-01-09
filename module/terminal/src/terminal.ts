import tty from 'tty';

import { IterableUtil, MapFn } from './iterable';
import { TerminalProgressEvent, TerminalTableConfig, TerminalTableEvent, TerminalWaitingConfig, TermLinePosition, TermState } from './types';
import { TerminalOperation } from './operation';
import { TerminalWriter } from './writer';
import { StyleInput } from './color-output';

type TerminalStreamPositionConfig = {
  position?: TermLinePosition;
  staticMessage?: string;
};

type TerminalProgressConfig = TerminalStreamPositionConfig & {
  style?: StyleInput;
};

/**
 * An enhanced tty write stream
 */
export class Terminal implements TermState {

  #output: tty.WriteStream;
  #input: tty.ReadStream;
  #interactive: boolean;
  #width?: number;

  constructor(output: tty.WriteStream, input: tty.ReadStream = process.stdin, interactive?: boolean, width?: number) {
    this.#output = output;
    this.#input = input;
    this.#interactive = interactive ?? (output.isTTY && !/^(true|yes|on|1)$/i.test(process.env.TRV_QUIET ?? ''));
    this.#width = width;
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

  /**
   * Waiting message with a callback to end
   */
  async withWaiting<T>(message: string, work: Promise<T> | (() => Promise<T>), config: TerminalWaitingConfig = {}): Promise<T> {
    const res = (typeof work === 'function' ? work() : work);
    if (!this.interactive) {
      await this.writeLines(`${message}...`);
      return res;
    }
    return res.finally(TerminalOperation.streamWaiting(this, message, config));
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
    return TerminalOperation.streamToPosition(this, IterableUtil.map(source, resolve), config?.position);
  }

  /**
   * Track progress of an asynchronous iterator, allowing the showing of a progress bar if the stream produces idx and total
   */
  async trackProgress<T, V extends TerminalProgressEvent>(
    source: AsyncIterable<T>, resolve: MapFn<T, V>, config?: TerminalProgressConfig
  ): Promise<void> {
    const render = TerminalOperation.buildProgressBar(this, config?.style ?? { background: 'limeGreen', text: 'black' });
    return this.streamToPosition(source, async (v, i) => render(await resolve(v, i)), config);
  }
}

export const GlobalTerminal = new Terminal(process.stdout);