import { ChildProcess } from 'node:child_process';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline/promises';

const MINUTE = (1000 * 60);

const RESULT = Symbol.for('@travetto/runtime:exec-result');

interface ExecutionBaseResult {
  /**
   * Exit code
   */
  code: number;
  /**
   * Execution result message, should be inline with code
   */
  message?: string;
  /**
   * Whether or not the execution completed successfully
   */
  valid: boolean;
}

/**
 * Result of an execution
 */
export interface ExecutionResult<T extends string | Buffer = string | Buffer> extends ExecutionBaseResult {
  /**
   * Stdout
   */
  stdout: T;
  /**
   * Stderr
   */
  stderr: T;
}

/**
 * Standard utilities for managing executions
 */
export class ExecUtil {

  static RESTART_EXIT_CODE = 200;

  /**
   * Run with automatic restart support
   * @param run The factory to produce the next running process
   * @param maxRetriesPerMinute The number of times to allow a retry within a minute
   */
  static async withRestart(run: () => ChildProcess, maxRetriesPerMinute?: number): Promise<ExecutionResult> {
    const maxRetries = maxRetriesPerMinute ?? 5;
    const restarts: number[] = [];

    for (; ;) {
      const proc = run();

      const toKill = (): void => { proc.kill('SIGKILL'); };
      const toMessage = (v: unknown): void => { proc.send?.(v!); };

      // Proxy kill requests
      process.on('message', toMessage);
      process.on('SIGINT', toKill);
      proc.on('message', v => process.send?.(v));

      const result = await this.getResult(proc, { catch: true });
      if (result.code !== this.RESTART_EXIT_CODE) {
        return result;
      } else {
        process.off('SIGINT', toKill);
        process.off('message', toMessage);
        restarts.unshift(Date.now());
        if (restarts.length === maxRetries) {
          if ((restarts[0] - restarts[maxRetries - 1]) <= MINUTE) {
            console.error(`Bailing, due to ${maxRetries} restarts in under a minute`);
            return result;
          }
          restarts.pop(); // Keep list short
        }
        console.error('Restarting...', { pid: process.pid });
      }
    }
  }

  /**
   * Take a child process, and some additional options, and produce a promise that
   * represents the entire execution.  On successful completion the promise will resolve, and
   * on failed completion the promise will reject.
   *
   * @param proc The process to enhance
   * @param options The options to use to enhance the process
   */
  static getResult(proc: ChildProcess): Promise<ExecutionResult<string>>;
  static getResult(proc: ChildProcess, options: { catch?: boolean, binary?: false }): Promise<ExecutionResult<string>>;
  static getResult(proc: ChildProcess, options: { catch?: boolean, binary: true }): Promise<ExecutionResult<Buffer>>;
  static getResult<T extends string | Buffer>(proc: ChildProcess, options: { catch?: boolean, binary?: boolean } = {}): Promise<ExecutionResult<T>> {
    const _proc: ChildProcess & { [RESULT]?: Promise<ExecutionResult> } = proc;
    const res = _proc[RESULT] ??= new Promise<ExecutionResult>(resolve => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let done = false;
      const finish = (result: ExecutionBaseResult): void => {
        if (done) {
          return;
        }
        done = true;

        const buffers = {
          stdout: Buffer.concat(stdout),
          stderr: Buffer.concat(stderr),
        };

        const final = {
          stdout: options.binary ? buffers.stdout : buffers.stdout.toString('utf8'),
          stderr: options.binary ? buffers.stderr : buffers.stderr.toString('utf8'),
          ...result
        };

        resolve(!final.valid ?
          { ...final, message: `${final.message || final.stderr || final.stdout || 'failed'}` } :
          final
        );
      };

      proc.stdout?.on('data', (d: string | Buffer) => stdout.push(Buffer.from(d)));
      proc.stderr?.on('data', (d: string | Buffer) => stderr.push(Buffer.from(d)));

      proc.on('error', (err: Error) =>
        finish({ code: 1, message: err.message, valid: false }));

      proc.on('close', (code: number) =>
        finish({ code, valid: code === null || code === 0 }));

      if (proc.exitCode !== null) { // We are already done
        finish({ code: proc.exitCode, valid: proc.exitCode === 0 });
      }
    });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (options.catch ? res : res.then(v => {
      if (v.valid) {
        return v;
      } else {
        throw new Error(v.message);
      }
    })) as Promise<ExecutionResult<T>>;
  }

  /**
   * Consume lines
   */
  static async readLines(stream: Readable, handler: (input: string) => unknown | Promise<unknown>): Promise<void> {
    for await (const item of createInterface(stream)) {
      await handler(item);
    }
  }
}