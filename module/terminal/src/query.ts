import type tty from 'node:tty';
import { spawn } from 'node:child_process';

import { ANSICodes } from './codes';
import { IterableUtil } from './iterable';
import { TermCoord, TermQuery } from './types';

const queryScript = (function (...bytes: number[]): void {
  const i = process.stdin;
  i.setRawMode(true);
  i.resume();
  i.once('readable', function () {
    const inp = i.read();
    /* @ts-expect-error */
    process.send(Buffer.isBuffer(inp) ? inp.toString('utf8') : inp);
    i.setRawMode(false);
  });
  process.stdout.write(String.fromCharCode(...bytes));
});

const runQuery = async (input: tty.ReadStream, output: tty.WriteStream, code: string): Promise<Buffer> => {
  const script = queryScript.toString().replaceAll('\'', '"').replaceAll('\n', '');
  const fullScript = `(${script})(${code.split('').map(x => x.charCodeAt(0))})`;
  const proc = spawn(process.argv0, ['-e', fullScript], { stdio: [input, output, 2, 'ipc'], detached: true });
  const text = await new Promise<string>((res, rej) => {
    proc.once('message', res);
    proc.on('error', rej);
  });
  return Buffer.from(text, 'utf8');
};

const ANSIQueries = {
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

  constructor(input: tty.ReadStream, output: tty.WriteStream) {
    this.#input = input;
    this.#output = output;
  }

  query<T>(q: TermQuery<T>): Promise<T> {
    return this.#queue.add(() => runQuery(this.#input, this.#output, q.query()).then(q.response));
  }

  cursorPosition(): Promise<TermCoord> {
    return this.query(ANSIQueries.cursorPosition);
  }

  close(): void {
    this.#queue.close();
  }
}