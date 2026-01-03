import { type ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { setTimeout } from 'node:timers/promises';

import { castTo } from './types.ts';

const ResultSymbol = Symbol();

type RunWithResultOptions = {
  run: (signal: AbortSignal) => Promise<unknown>;
  timeout?: number;
  maxRetries?: number
  restartDelay?: number;
  onRestart?: () => (unknown | Promise<unknown>);
  onFailure?: () => (unknown | Promise<unknown>);
  onInit?: (controller: AbortController) => Function;
}

/**
 * Result of an execution
 */
export interface ExecutionResult<T extends string | Buffer = string | Buffer> {
  /**
   * Stdout
   */
  stdout: T;
  /**
   * Stderr
   */
  stderr: T;
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

type ExecutionBaseResult = Omit<ExecutionResult, 'stdout' | 'stderr'>;

/**
 * Standard utilities for managing executions
 */
export class ExecUtil {

  static RESTART_CODE = 200;

  /**
   * Listen for restart signal
   */
  static listenForRestartSignal(): void {
    process.on('message', (event) => {
      if (typeof event === 'object' && event !== null && 'type' in event && event.type === 'EXEC_RESTART') {
        this.exitForRestart();
      }
    });
  }

  /**
   * Exit process for restart
   */
  static exitForRestart(): void {
    process.exit(this.RESTART_CODE);
  }

  /**
   * Send restart signal
   */
  static sendRestartSignal(child?: ChildProcess): void {
    if (child?.connected) {
      child.send({ type: 'EXEC_RESTART' });
    }
  }

  /**
   * Proxy subprocess execution bridging IPC
   */
  static async proxySubprocess(child: ChildProcess, relayInterrupt: boolean = false): Promise<ExecutionResult> {
    if (!relayInterrupt) {
      process.removeAllListeners('SIGINT'); // Remove any existing listeners
      process.on('SIGINT', () => { }); // Prevents SIGINT from killing parent process, the child will handle
    }

    child.on('message', value => process.send?.(value));

    const interrupt = (): void => { child?.kill('SIGINT'); };
    const toMessage = (value: unknown): void => { child?.send(value!); };

    // Proxy kill requests
    process.on('message', toMessage);

    if (relayInterrupt) {
      process.on('SIGINT', interrupt);
    }

    const result = await ExecUtil.getResult(child, { catch: true });
    process.exitCode = child.exitCode;
    process.off('message', toMessage);
    process.off('SIGINT', interrupt);
    return result;
  }

  /**
   * Run with restart capability
   */
  static async runWithRestart(config: RunWithResultOptions): Promise<void> {
    const timeout = config?.timeout ?? 10 * 1000;
    const iterations = new Array(config?.maxRetries ?? 10).fill(Date.now());
    const controller = new AbortController();
    const { signal } = controller;
    const cleanup = config.onInit?.(controller) ?? undefined;
    let restarted = false;
    let timeoutExceeded = false;
    let result;

    while (!signal.aborted && !timeoutExceeded && result !== false) {

      if (restarted) {
        await setTimeout(config.restartDelay ?? 10);
        await config?.onRestart?.();
      }

      result = await config.run(signal);

      iterations.push(Date.now());
      iterations.shift();
      restarted = true;
      timeoutExceeded = (Date.now() - iterations[0]) > timeout;
    }

    if (timeoutExceeded) {
      await config?.onFailure?.();
    }

    cleanup?.();
  }

  /**
   * Take a child process, and some additional options, and produce a promise that
   * represents the entire execution.  On successful completion the promise will resolve, and
   * on failed completion the promise will reject.
   *
   * @param subProcess The process to enhance
   * @param options The options to use to enhance the process
   */
  static getResult(subProcess: ChildProcess): Promise<ExecutionResult<string>>;
  static getResult(subProcess: ChildProcess, options: { catch?: boolean, binary?: false }): Promise<ExecutionResult<string>>;
  static getResult(subProcess: ChildProcess, options: { catch?: boolean, binary: true }): Promise<ExecutionResult<Buffer>>;
  static getResult<T extends string | Buffer>(subProcess: ChildProcess, options: { catch?: boolean, binary?: boolean } = {}): Promise<ExecutionResult<T>> {
    const typed: ChildProcess & { [ResultSymbol]?: Promise<ExecutionResult> } = subProcess;
    const result = typed[ResultSymbol] ??= new Promise<ExecutionResult>(resolve => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let done = false;
      const finish = (finalResult: ExecutionBaseResult): void => {
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
          ...finalResult
        };

        resolve(!final.valid ?
          { ...final, message: `${final.message || final.stderr || final.stdout || 'failed'}` } :
          final
        );
      };

      subProcess.stdout?.on('data', (data: string | Buffer) => stdout.push(Buffer.isBuffer(data) ? data : Buffer.from(data)));
      subProcess.stderr?.on('data', (data: string | Buffer) => stderr.push(Buffer.isBuffer(data) ? data : Buffer.from(data)));

      subProcess.on('error', (error: Error) =>
        finish({ code: 1, message: error.message, valid: false }));

      subProcess.on('close', (code: number) =>
        finish({ code, valid: code === null || code === 0 }));

      if (subProcess.exitCode !== null) { // We are already done
        finish({ code: subProcess.exitCode, valid: subProcess.exitCode === 0 });
      }
    });

    return castTo(options.catch ? result : result.then(executionResult => {
      if (executionResult.valid) {
        return executionResult;
      } else {
        throw new Error(executionResult.message);
      }
    }));
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