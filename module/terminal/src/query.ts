import tty from 'tty';

/**
 * Terminal query support with centralized queuing for multiple writes to the same stream
 */
export class TerminalQuerier {

  static #readQueue = new Map<tty.ReadStream, (() => Promise<void>)[]>();
  static #reading = new Map<tty.ReadStream, Promise<void>>();

  static async #startReading(stream: tty.ReadStream): Promise<void> {
    const q = this.#readQueue.get(stream) ?? [];
    let i = 0;
    while (q.length > 0) {
      if (i === 0) {
        stream.setRawMode(true);
      }
      try {
        await (q.shift()!)();
      } catch { } // Ignore
      i += 1;
    }
    if (i > 0) {
      stream.setRawMode(false);
    }
    this.#readQueue.set(stream, []);
  }

  static #enqueueWork<T>(stream: tty.ReadStream, work: () => Promise<T>): Promise<T> {
    const q = TerminalQuerier.#readQueue.get(stream)!;
    const prom = new Promise<T>(res => q.push(() => work().then(res)));
    const reading = this.#reading.get(stream);
    this.#reading.set(stream, reading ?? this.#startReading(stream));
    return prom;
  }

  #output: tty.WriteStream;
  #input: tty.ReadStream;

  constructor(input: tty.ReadStream, output: tty.WriteStream) {
    this.#input = input;
    this.#output = output;
    if (!TerminalQuerier.#readQueue.has(this.#input)) {
      TerminalQuerier.#readQueue.set(this.#input, []);
    }
  }

  async #readInput(query: string): Promise<Buffer> {
    // Send data, but do not wait on it
    this.#output.write(query);
    await new Promise(res => this.#input.once('readable', res));
    const val: Buffer | string = this.#input.read();
    return typeof val === 'string' ? Buffer.from(val, 'utf8') : val;
  }

  /**
   * Read input given term state
   */
  runQuery(query: string): Promise<Buffer> {
    return TerminalQuerier.#enqueueWork(this.#input, () => this.#readInput(query));
  }

  close(): Promise<void> | undefined {
    return TerminalQuerier.#reading.get(this.#input);
  }
}