import tty from 'tty';

import { ANSICodes } from './codes';
import { IterableUtil } from './iterable';
import { RGB, TermCoord, TermQuery } from './types';

const to256 = (x: string): number => Math.trunc(parseInt(x, 16) / (16 ** (x.length - 2)));
const COLOR_RESPONSE = /(?<r>][0-9a-f]+)[/](?<g>[0-9a-f]+)[/](?<b>[0-9a-f]+)[/]?(?<a>[0-9a-f]+)?/i;

const ANSIQueries = {
  /** Parse xterm color response */
  color: (field: 'background' | 'foreground'): TermQuery<RGB | undefined> => ({
    query: (): string => ANSICodes.OSC_QUERY(`${field}Color`),
    response: (response: Buffer): RGB | undefined => {
      const groups = response.toString('utf8').match(COLOR_RESPONSE)?.groups ?? {};
      return 'r' in groups ? [to256(groups.r), to256(groups.g), to256(groups.b)] : undefined;
    }
  }),
  /** Parse cursor query response into {x,y} */
  cursorPosition: {
    query: (): string => ANSICodes.DEVICE_STATUS_REPORT('cursorPosition'),
    response: (response: Buffer): TermCoord => {
      const groups = response.toString('utf8').match(/(?<r>\d*);(?<c>\d*)/)?.groups ?? {};
      return 'c' in groups ? { x: +(groups.c) - 1, y: +(groups.r) - 1 } : { x: 0, y: 0 };
    }
  }
};

/**
 * Terminal query support with centralized queuing for multiple writes to the same stream
 */
export class TerminalQuerier {

  static #cache = new Map<tty.ReadStream, TerminalQuerier>();

  static for(input: tty.ReadStream, output: tty.WriteStream): TerminalQuerier {
    if (!this.#cache.has(input)) {
      this.#cache.set(input, new TerminalQuerier(input, output));
    }
    return this.#cache.get(input)!;
  }

  #queue = IterableUtil.simpleQueue();
  #output: tty.WriteStream;
  #input: tty.ReadStream;
  #restore?: () => void;

  constructor(input: tty.ReadStream, output: tty.WriteStream) {
    this.#input = input;
    this.#output = output;
  }

  async #readInput(query: string): Promise<Buffer> {
    const isRaw = this.#input.isRaw;
    const isPaused = this.#input.isPaused();
    const data = this.#input.listeners('data');

    this.#restore = (): void => {
      this.#input.removeAllListeners('readable');

      if (isPaused) {
        this.#input.pause();
      }
      this.#input.setRawMode(isRaw);
      for (const fn of data) {
        // @ts-ignore
        this.#input.on('data', fn);
      }
    };

    try {
      this.#input.removeAllListeners('data');

      if (isPaused) {
        this.#input.resume();
      }

      this.#input.setRawMode(true);
      // Send data, but do not wait on it
      this.#output.write(query);
      await new Promise(res => this.#input.once('readable', res));
      const val: Buffer | string = this.#input.read();
      return typeof val === 'string' ? Buffer.from(val, 'utf8') : val;
    } finally {
      this.#restore?.();
      this.#restore = undefined;
    }
  }

  query<T>(q: TermQuery<T>): Promise<T> {
    return this.#queue.add(() => this.#readInput(q.query()).then(q.response));
  }

  cursorPosition(): Promise<TermCoord> {
    return this.query(ANSIQueries.cursorPosition);
  }

  backgroundColor(): Promise<RGB | undefined> {
    return this.query(ANSIQueries.color('background'));
  }

  close(): void {
    this.#restore?.();
    this.#queue.close();
  }
}