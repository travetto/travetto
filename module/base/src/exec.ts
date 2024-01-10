import { ChildProcess, Serializable, spawn, SpawnOptions } from 'node:child_process';
import { PassThrough, Readable, Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';

import { StreamUtil } from './stream';

const MINUTE = (1000 * 60);

type Complete = { valid: Boolean, code: number, message?: string };

export type ExecOptions = SpawnOptions;

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

export class ExecutionResult implements Complete {
  /**
   * Exit code
   */
  readonly code: number;
  /**
   * Execution result message, should be inline with code
   */
  readonly message?: string;
  /**
   * Whether or not the execution completed successfully
   */
  readonly valid: boolean;
  /**
   * Initial spawn request
   */
  readonly spawn: ExecutionState;

  constructor(proc: ExecutionState, comp: Complete) {
    this.spawn = proc;
    this.valid = !comp.code;
    Object.assign(this, comp);
  }

  /**
   * Stdout as a string
   */
  get stdout(): string {
    const encoding = this.spawn.raw.stdout?.readableEncoding;
    return this.spawn.stdout?.rawOutput?.toString(encoding ?? 'utf8') ?? '';
  }
  /**
   * Stderr as a string
   */
  get stderr(): string {
    const encoding = this.spawn.raw.stdout?.readableEncoding;
    return this.spawn.stderr?.rawOutput?.toString(encoding ?? 'utf8') ?? '';
  }
}

export class ExecutionState {
  #complete: Promise<Complete>;
  #result: Promise<ExecutionResult>;
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

  get complete(): Promise<ExecutionResult> {
    return this.#result ??= this.done.then(async v => new ExecutionResult(this, v));
  }

  kill(): void {
    process.kill(this.raw.pid!, ...(process.platform === 'win32' ? [] : ['SIGTERM']));
  }

  send(message: Serializable, cb?: (err: Error | null) => void): void {
    this.raw.send?.(message, cb);
  }

  onMessage(cb: (val: Serializable) => void): void {
    this.raw.on('message', cb);
  }

  unref(): void {
    this.raw.unref();
  }

  get result(): Promise<ExecutionResult> {
    return this.complete.then(v => {
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
      await this.complete;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return buf as Promise<T>;
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return StreamUtil.waitForCompletion(this.raw.stdout!, () => this.complete) as Promise<T>;
    }
  }
}

/**
 * Standard utilities for managing executions
 */
export class ExecUtil {

  static RESTART_EXIT_CODE = 200;

  /**
   * Run a command directly, as a stand alone operation
   * @param cmd The command to run
   * @param args The command line arguments to pass
   * @param options The enhancement options
   */
  static spawn(cmd: string, args: string[] = [], options: ExecOptions = {}): ExecutionState {
    return new ExecutionState(spawn(cmd, args, options));
  }

  /**
   * Spawn with automatic restart support
   * @param cmd The command to run
   * @param args The command line arguments to pass
   * @param options The enhancement options
   */
  static async spawnWithRestart(cmd: string, args: string[], options: ExecOptions = {}, maxRetries: number = 5): Promise<ExecutionResult> {
    const restarts: number[] = [];

    process.once('disconnect', () => process.kill(process.pid));

    for (; ;) {
      const state = this.spawn(cmd, args, options);

      const toKill = (): void => { state.kill(); };
      const toMessage = (v: unknown): void => { state.send(v!); };

      // Proxy kill requests
      process.on('message', toMessage);
      process.on('SIGINT', toKill);
      state.onMessage(v => process.send?.(v));

      const result = await state.complete;
      if (result.code !== this.RESTART_EXIT_CODE) {
        return result;
      } else {
        process.off('SIGINT', toKill);
        process.off('message', toMessage);
        restarts.unshift(Date.now());
        if (restarts.length === maxRetries) {
          if ((restarts[0] - restarts[maxRetries - 1]) <= MINUTE) {
            console.error(`Bailing, due to ${maxRetries} restarts in under a minute`);
            return state.result;
          }
          restarts.pop(); // Keep list short
        }
        console.error('Restarting...', { pid: process.pid });
      }
    }
  }
}