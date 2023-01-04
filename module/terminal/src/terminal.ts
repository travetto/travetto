import tty from 'tty';

import { TerminalStream } from './stream';
import { TerminalUtil } from './util';
import { TerminalOperation, TerminalTableEvent, TerminalProgressEvent, TerminalProgressConfig, TerminalTableConfig } from './operation';
import { ColorOutputUtil } from './color-output';

/**
 * An enhanced tty write stream
 */
export class Terminal {

  #stream: TerminalStream;

  constructor(stream: TerminalStream | tty.WriteStream) {
    this.#stream = stream instanceof TerminalStream ? stream : new TerminalStream(stream);
  }

  get stream(): TerminalStream {
    return this.#stream;
  }

  async lines(...lines: string[]): Promise<void> {
    return this.#stream.writeLines(lines);
  }

  /**
   * Waiting message with a callback to end
   */
  async withWaiting<T>(message: string, work: Promise<T> | (() => Promise<T>), config: TerminalProgressConfig = {}): Promise<T> {
    const res = (typeof work === 'function' ? work() : work);
    if (config.interactive) {
      const indicator = TerminalOperation.waitingIndicator(message);

      const live = TerminalOperation.streamToLine(
        this.#stream,
        indicator.stream,
        ev => ev.message,
        { initialDelay: 1000, cycleDelay: 50, ...config, position: 'inline' }
      );

      try {
        return await res;
      } finally {
        await indicator.finish();
        await live;
      }
    } else {
      this.#stream.writeLine(`${message}...`);
      return res;
    }
  }

  /**
   * Consumes a stream, of events, tied to specific list indices, and updates in place
   */
  async makeList<T>(source: AsyncIterable<T>, resolve: (val: T) => TerminalTableEvent, config: TerminalTableConfig = {}): Promise<void> {
    return TerminalOperation.makeList(this.#stream, TerminalUtil.mapIterable(source, resolve), config);
  }

  /**
   * Track progress of an asynchronous iterator, allowing the showing of a progress bar if the stream produces idx and total
   */
  async trackProgress<T>(
    message: string, source: AsyncIterable<T>,
    resolve: (val: T) => TerminalProgressEvent,
    config: TerminalProgressConfig = {}
  ): Promise<void> {
    const interactive = config.interactive ?? this.#stream.interactive;
    const color = ColorOutputUtil.colorer({ background: 'green', text: 'white' });

    if (!interactive) {
      this.#stream.writeLine(`${message}...`);
    }

    return TerminalOperation.streamToLine(
      this.#stream,
      TerminalUtil.mapIterable(source, resolve),
      ({ total, idx, status }): string => {
        const line = [message, total ? `${idx}/${total}` : `${idx}`, status].filter(x => !!x).join(' ');
        return TerminalOperation.stylePercentage(line, idx, total, this.#stream.columns, color);
      },
      config);
  }
}

export const GlobalTerminal = new Terminal(process.stdout);