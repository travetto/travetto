import { createInterface } from 'node:readline/promises';
import { ChildProcess, SpawnOptions, spawn } from 'node:child_process';
import { PassThrough, Readable, Writable } from 'node:stream';

import type { ExecutionResult } from './exec';
import { StreamUtil } from './stream';

type Complete = { valid: Boolean, code: number, message?: string };

class OutputChannel {
  #src: Readable;
  #captured: Buffer[] = [];
  #output = new PassThrough();
  #isCapture: boolean | undefined;
  #received = 0;

  constructor(src: Readable) {
    this.#src = src;
    this.#listen();
  }

  async #listen(): Promise<void> {
    for await (const d of this.#src) {
      this.#received += d.length;
      if (this.#isCapture !== false) {
        this.#captured.push(Buffer.from(d));
      }
      this.#output.write(d, this.#src.readableEncoding!);
    }
  }

  get received(): number {
    return this.#received;
  }

  noCapture(): OutputChannel {
    this.#isCapture ??= false;
    this.#captured = this.#isCapture ? this.#captured : [];
    return this;
  }

  get stream(): Readable {
    return this.#output;
  }

  get rawOutput(): Buffer | undefined {
    return Buffer.concat(this.#captured);
  }

  pipe(writable: Writable, opts?: { end?: boolean }): void {
    this.stream?.pipe(writable, opts);
  }

  get lines(): AsyncIterable<string> {
    return createInterface({ input: this.stream, terminal: false });
  }

  async onLine(cb: (text: string) => unknown): Promise<void> {
    for await (const line of this.lines) {
      await cb(line);
    }
  }
}

class SpawnResult implements Complete, ExecutionResult {

  readonly spawn: Spawn;
  readonly code: number;
  readonly message?: string;
  readonly valid: boolean;

  constructor(proc: Spawn, comp: Complete) {
    this.spawn = proc;
    this.valid = !comp.code;
    Object.assign(this, comp);
  }

  get stdout(): string {
    const encoding = this.spawn.raw.stdout?.readableEncoding;
    return this.spawn.stdout?.rawOutput?.toString(encoding ?? 'utf8') ?? '';
  }
  get stderr(): string {
    const encoding = this.spawn.raw.stdout?.readableEncoding;
    return this.spawn.stderr?.rawOutput?.toString(encoding ?? 'utf8') ?? '';
  }
}

export class Spawn {
  static exec(cmd: string, args?: string[], opts?: SpawnOptions): Spawn {
    return new Spawn(spawn(cmd, args ?? [], opts ?? {}));
  }

  #complete: Promise<Complete>;
  #result: Promise<SpawnResult>;
  stdout?: OutputChannel;
  stderr?: OutputChannel;
  stdin?: Writable;
  raw: ChildProcess;

  constructor(proc: ChildProcess) {
    this.raw = proc;
    this.stdin = proc.stdin!;
    this.stderr = proc.stderr ? new OutputChannel(proc.stderr) : undefined;
    this.stdout = proc.stdout ? new OutputChannel(proc.stdout) : undefined;
  }

  get done(): Promise<Complete> {
    return this.#complete ??= new Promise<Complete>((resolve) => {
      this.raw.on('error', (e: Error) => resolve({ code: this.raw.exitCode ?? 0, valid: false, message: e.message }));
      this.raw.on('close', (exitCode: number) => resolve({ code: exitCode, valid: !exitCode }));
    });
  }

  get result(): Promise<SpawnResult> {
    return this.#result ??= this.done.then(async v => new SpawnResult(this, v));
  }

  kill(): void {
    process.kill(this.raw.pid!, ...(process.platform === 'win32' ? [] : ['SIGTERM']));
  }

  get success(): Promise<SpawnResult> {
    return this.result.then(v => {
      if (!v.valid) { throw new Error(v.message ?? `Execution failure - ${v.code}`); }
      else { return v; }
    });
  }

  /**
   * Pipe a buffer into an execution state
   * @param state The execution state to pipe
   * @param input The data to input into the process
   */
  async execPipe<T extends Buffer | Readable>(input: T): Promise<T> {
    (await StreamUtil.toStream(input)).pipe(this.raw.stdin!);

    if (input instanceof Buffer) { // If passing buffers
      const buf = StreamUtil.toBuffer(this.raw.stdout!);
      await this.result;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return buf as Promise<T>;
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return StreamUtil.waitForCompletion(this.raw.stdout!, () => this.result) as Promise<T>;
    }
  }
}