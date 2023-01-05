import tty from 'tty';

import { IterableUtil } from './iterable';
import { TerminalProgressConfig, TerminalProgressEvent, TerminalTableConfig, TerminalTableEvent, TerminalWaitingConfig, TermState } from './types';
import { TerminalOperation } from './operation';
import { TerminalWriter } from './writer';

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

  writeLines(...text: string[]): Promise<void> {
    return this.writer().writeLines(text).commit();
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
  async makeList<T>(source: AsyncIterable<T>, resolve: (val: T) => TerminalTableEvent, config: TerminalTableConfig = {}): Promise<void> {
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
   * Track progress of an asynchronous iterator, allowing the showing of a progress bar if the stream produces idx and total
   */
  async trackProgress<T, V extends TerminalProgressEvent>(
    message: string, source: AsyncIterable<T>, resolve: (val: T) => V, config?: TerminalProgressConfig
  ): Promise<void> {
    if (!this.interactive) {
      await this.writeLines(`${message}...`);
      await IterableUtil.drain(source);
      return;
    }
    const render = config?.renderer ?? TerminalOperation.buildProgressBar(this, { background: 'green', text: 'white' }, message);
    return TerminalOperation.streamToPosition(this, IterableUtil.map(source, resolve, render), config?.position);
  }
}

export const GlobalTerminal = new Terminal(process.stdout);