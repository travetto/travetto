import rl from 'node:readline';
import { ChildProcess, spawn, SpawnOptions } from 'node:child_process';
import { Readable } from 'node:stream';

import { path } from '@travetto/manifest';

import { Env } from './env';

const MINUTE = (1000 * 60);

/**
 * Result of an execution
 */
export interface ExecutionResult {
  /**
   * Exit code
   */
  code: number;
  /**
   * Stdout as a string
   */
  stdout: string;
  /**
   * Stderr as a string
   */
  stderr: string;
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
 * Execution State
 */
export interface ExecutionState {
  process: ChildProcess;
  result: Promise<ExecutionResult>;
}

/**
 * Options for running executions
 */
export interface ExecutionOptions extends SpawnOptions {
  /**
   * Should an error be caught and returned as a result. Determines whether an exit code > 0 throws
   * an Error, or if it merely marks the process as completed, marking the result as invalid.
   */
  catchAsResult?: boolean;
  /**
   * Should the environment be isolated, or inherit from process.env
   */
  isolatedEnv?: boolean;
  /**
   * Built in timeout for any execution. The number of milliseconds the process can run before
   * terminating and throwing an error
   */
  timeout?: number;
  /**
   * Determines how to treat the stdout/stderr data.
   *  - 'text' will assume the output streams are textual, and will convert to unicode data.
   *  - 'text-stream' makes the same assumptions as 'text', but will only fire events, and will
   *        not persist any data.  This is really useful for long running programs.
   *  - 'binary' treats all stdout/stderr data as raw buffers, and will not perform any transformations.
   *  - 'raw' avoids touching stdout/stderr altogether, and leaves it up to the caller to decide.
   */
  outputMode?: 'raw' | 'binary' | 'text' | 'text-stream';
  /**
   * On stderr line.  Requires 'outputMode' to be either 'text' or 'text-stream'
   */
  onStdErrorLine?: (line: string) => void;
  /**
   * On stdout line.  Requires 'outputMode' to be either 'text' or 'text-stream'
   */
  onStdOutLine?: (line: string) => void;
  /**
   * The stdin source for the execution
   */
  stdin?: string | Buffer | Readable;
}

/**
 * Options for restartable spawn
 */
export type RestartExecutionOptions = Omit<ExecutionOptions, 'catchAsResult'> & { maxRetriesPerMinute?: number };

type ErrorWithMeta = Error & { meta?: ExecutionResult };

/**
 * Standard utilities for managing executions
 */
export class ExecUtil {

  static RESTART_EXIT_CODE = 200;

  /**
   * Get standard execution options
   * @param opts The options to build out
   */
  static #getOpts(opts: ExecutionOptions): ExecutionOptions {
    return {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      cwd: path.cwd(),
      shell: false,
      outputMode: 'text',
      ...opts,
      env: {
        // Preserve path when isolating
        ...(opts.isolatedEnv ? { PATH: process.env.PATH } : process.env),
        ...Env.TRV_DYNAMIC.export(false), // Force dynamic to not cascade
        ...(opts.env ?? {})
      }
    };
  }

  /**
   * Take a child process, and some additional options, and produce a promise that
   * represents the entire execution.  On successful completion the promise will resolve, and
   * on failed completion the promise will reject.
   *
   * @param proc The process to enhance
   * @param options The options to use to enhance the process
   * @param cmd The command being run
   */
  static #enhanceProcess(proc: ChildProcess, options: ExecutionOptions, cmd: string): Promise<ExecutionResult> {
    const timeout = options.timeout;

    const res = new Promise<ExecutionResult>((resolve, reject) => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let timer: NodeJS.Timeout;
      let done = false;
      const finish = function (result: Omit<ExecutionResult, 'stderr' | 'stdout'>): void {
        if (done) {
          return;
        }
        if (timer) {
          clearTimeout(timer);
        }
        done = true;

        const final = {
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
          ...result
        };

        if (!final.valid) {
          const err: ErrorWithMeta = new Error(`Error executing ${cmd}: ${final.message || final.stderr || final.stdout || 'failed'}`);
          err.meta = final;
          reject(err);
        } else {
          resolve(final);
        }
      };

      switch (options.outputMode ?? 'text') {
        case 'binary': {
          proc.stdout?.on('data', (d: string | Buffer) => stdout.push(Buffer.from(d)));
          proc.stderr?.on('data', (d: string | Buffer) => stderr.push(Buffer.from(d)));
          break;
        }
        case 'text':
        case 'text-stream': {
          // If pipes exists
          if (proc.stdout) {
            rl.createInterface(proc.stdout).on('line', line => {
              options.onStdOutLine?.(`${line}\n`);
              if (options.outputMode !== 'text-stream') {
                stdout.push(Buffer.from(line), Buffer.from('\n'));
              }
            });
          }
          if (proc.stderr) {
            rl.createInterface(proc.stderr).on('line', line => {
              options.onStdErrorLine?.(`${line}\n`);
              if (options.outputMode !== 'text-stream') {
                stderr.push(Buffer.from(line), Buffer.from('\n'));
              }
            });
          }
        }
      }

      proc.on('error', (err: Error) =>
        finish({ code: 1, message: err.message, valid: false }));

      proc.on('close', (code: number) =>
        finish({ code, valid: code === null || code === 0 || code === 130 || code === 143 })); // Sigint/term

      if (timeout) {
        timer = setTimeout(async x => {
          this.kill(proc);
          finish({ code: 1, message: `Execution timed out after: ${timeout} ms`, valid: false });
        }, timeout);
      }
    });

    return options.catchAsResult ? res.catch((err: ErrorWithMeta) => err.meta!) : res;
  }

  /**
   * Run a command directly, as a stand alone operation
   * @param cmd The command to run
   * @param args The command line arguments to pass
   * @param options The enhancement options
   */
  static spawn(cmd: string, args: string[] = [], options: ExecutionOptions = {}): ExecutionState {
    const proc = spawn(cmd, args, this.#getOpts(options));
    const result = this.#enhanceProcess(proc, options, `${cmd} ${args.join(' ')}`);
    return { process: proc, result };
  }

  /**
   * Spawn with automatic restart support
   * @param cmd The command to run
   * @param args The command line arguments to pass
   * @param options The enhancement options
   */
  static async spawnWithRestart(cmd: string, args: string[], options: RestartExecutionOptions = {}): Promise<ExecutionResult> {
    const maxRetries = options.maxRetriesPerMinute ?? 5;
    const restarts: number[] = [];

    process.once('disconnect', () => ExecUtil.kill(process));

    for (; ;) {
      const state = this.spawn(cmd, args, { outputMode: 'raw', ...options, catchAsResult: true });

      const toKill = (): void => { state.process.kill('SIGKILL'); };
      const toMessage = (v: unknown): void => { state.process.send?.(v!); };

      // Proxy kill requests
      process.on('message', toMessage);
      process.on('SIGINT', toKill);
      state.process.on('message', v => process.send?.(v));

      const result = await state.result;
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

  /**
   * Kill a spawned process
   * @param proc The process to kill
   */
  static kill(procOrPid?: { pid?: number } | number): void {
    const args = process.platform === 'win32' ? [] : ['SIGTERM'];
    if (typeof procOrPid === 'number') {
      process.kill(procOrPid, ...args);
    } else if (procOrPid?.pid) {
      process.kill(procOrPid.pid, ...args);
    }
  }
}