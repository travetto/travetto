import { ChildProcess, SpawnOptions, spawn, execSync } from 'child_process';
import { Readable } from 'stream';
import { SHARE_ENV, Worker, WorkerOptions } from 'worker_threads';

import { PathUtil } from './path';
import { StreamUtil } from './stream';

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
  /**
   * Whether or not the execution was killed
   */
  killed?: boolean;
}

/**
 * Result of a worker delegation
 */
export interface WorkerResult<T> {
  worker: Worker;
  message: Promise<T>;
  result: Promise<number>;
}

/**
 * A result that supports catching as part of the promise resolution
 */
export type CatchableResult = Promise<ExecutionResult> & { catchAsResult?(): Promise<ExecutionResult> };

type ErrorWithMeta = Error & { meta?: ExecutionResult };

/**
 * Execution State
 */
export interface ExecutionState<T extends Promise<ExecutionResult> = Promise<ExecutionResult>> {
  process: ChildProcess;
  result: T;
}

/**
 * Options for running executions
 */
export interface ExecutionOptions extends SpawnOptions {
  /**
   * Should the environment be isolated, or inherit from process.env
   */
  isolatedEnv?: boolean;
  /**
   * Built in timeout for any execution
   */
  timeout?: number;
  /**
   * Whether or not to collect stdin/stdout, defaults to false
   */
  rawOutput?: boolean;
  /**
   * The stdin source for the execution
   */
  stdin?: string | Buffer | Readable;
}

/**
 * Standard utilities for managing executions
 */
export class ExecUtil {
  /**
   * Get standard execution options
   * @param opts The options to build out
   */
  static getOpts(opts: ExecutionOptions): ExecutionOptions {
    return {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      cwd: PathUtil.cwd,
      shell: false,
      ...opts,
      env: {
        // Preserve path when isolating
        ...(opts.isolatedEnv ? { PATH: process.env.PATH } : process.env),
        TRV_DYNAMIC: '0', // Force dynamic to not cascade
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
  static enhanceProcess(proc: ChildProcess, options: ExecutionOptions, cmd: string): CatchableResult {
    const timeout = options.timeout;

    const res: CatchableResult = new Promise<ExecutionResult>((resolve, reject) => {
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

      if (!options.rawOutput) {
        if (proc.stdout) {
          proc.stdout!.on('data', (d: string | Buffer) => stdout.push(Buffer.from(d)));
        }
        if (proc.stderr) {
          proc.stderr!.on('data', (d: string | Buffer) => stderr.push(Buffer.from(d)));
        }
      }

      proc.on('error', (err: Error) =>
        finish({ code: 1, message: err.message, valid: false }));

      proc.on('close', (code: number) =>
        finish({ code, valid: code === null || code === 0 || code === 130 || code === 143 })); // Sigint/term

      if (timeout) {
        timer = setTimeout(async x => {
          proc.kill('SIGKILL');
          finish({ code: 1, message: `Execution timed out after: ${timeout} ms`, valid: false, killed: true });
        }, timeout);
      }
    });

    res.catchAsResult = (): Promise<ExecutionResult> => res.catch((err: ErrorWithMeta) => err.meta!);
    return res;
  }

  /**
   * Run a command directly, as a stand alone operation
   * @param cmd The command to run
   * @param args The command line arguments to pass
   * @param options The enhancement options
   */
  static spawn(cmd: string, args: string[] = [], options: ExecutionOptions = {}): ExecutionState<CatchableResult> {
    const proc = spawn(cmd, args, this.getOpts(options));
    const result = this.enhanceProcess(proc, options, `${cmd} ${args.join(' ')}`);
    return { process: proc, result };
  }

  /**
   * Run a command relative to the current node executable.  Mimics how node's
   * fork operation is just spawn with the command set to `process.argv0`
   * @param cmd The file to run
   * @param args The command line arguments to pass
   * @param options The enhancement options
   */
  static fork(file: string, args: string[] = [], options: ExecutionOptions = {}): ExecutionState<CatchableResult> {
    // Always register for the fork
    const opts = this.getOpts(options);
    const spawnArgs = [file, ...args];
    const proc = spawn(process.argv0, spawnArgs, opts);
    const result = this.enhanceProcess(proc, options, spawnArgs.join(' '));
    return { process: proc, result };
  }

  /**
   * Run a file as worker thread
   * @param file The file to run, if starts with @, will be resolved as a module
   * @param args The arguments to pass in
   * @param options The worker options
   */
  static worker<T = unknown>(file: string, args: string[] = [], options: WorkerOptions & { minimal?: boolean } = {}): WorkerResult<T> {
    const worker = new Worker(file, {
      stderr: true,
      stdout: true,
      stdin: false,
      ...options,
      env: {
        ...process.env,
        TRV_DYNAMIC: '0', // Force dynamic to not cascade
        ...((options.env !== SHARE_ENV ? options.env : {}) || {}),
      },
      argv: args
    });

    const stderr: Buffer[] = [];
    worker.stdout!.on('data', (d: string | Buffer) => { }); // Ignore
    worker.stderr!.on('data', (d: string | Buffer) => stderr.push(Buffer.from(d)));

    const result = new Promise<number>((res, rej) =>
      worker
        .on('error', e => rej(e))
        .on('exit', c => {
          if (c > 0) {
            const msg = Buffer.concat(stderr).toString();
            if (!options.minimal) {
              console.warn(msg);
              process.exit(c);
            } else {
              rej(msg);
            }
          } else {
            res(c);
          }
        })
    );

    const message = new Promise<T>((res, rej) => {
      worker.once('message', d => result.then(() => {
        if (d && 'stack' in d && 'message' in d) {
          const err = new Error(d['message']);
          err.stack = d.stack;
          rej(err);
        } else {
          res(d);
        }
      }));
      result.catch(rej);
    });

    return { worker, message, result };
  }

  /**
   * Execute command synchronously
   * @param cmd The cmd to run
   * @param args The arguments to pass
   */
  static execSync(cmd: string, args?: string[]): string {
    if (args) {
      cmd = `${cmd} ${args.join(' ')}`;
    }
    return execSync(cmd, { stdio: ['pipe', 'pipe'], encoding: 'utf8' }).toString().trim();
  }

  /**
   * Pipe a buffer into an execution state
   * @param state The execution state to pipe
   * @param input The data to input into the process
   */
  static pipe(state: ExecutionState, input: Buffer): Promise<Buffer>;
  static pipe(state: ExecutionState, input: string | Readable): Promise<Readable>;
  static async pipe(state: ExecutionState, input: Buffer | Readable | string): Promise<Buffer | Readable> {
    const { process: proc, result: prom } = state;

    (await StreamUtil.toStream(input)).pipe(proc.stdin!);

    if (input instanceof Buffer) { // If passing buffers
      const buf = StreamUtil.toBuffer(proc.stdout!);
      await prom;
      return buf;
    } else {
      return StreamUtil.waitForCompletion(proc.stdout!, () => prom);
    }
  }

  /**
   * Kill a spawned process
   * @param proc The process to kill
   */
  static kill(proc: { kill(sig?: string | number): void }): void {
    if (process.platform === 'win32') {
      proc.kill();
    } else {
      proc.kill('SIGTERM');
    }
  }
}