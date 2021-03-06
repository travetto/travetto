import { ChildProcess, SpawnOptions, spawn, execSync } from 'child_process';
import { SHARE_ENV, Worker, WorkerOptions } from 'worker_threads';
import { PathUtil } from './path';
import { StreamUtil } from './stream';

declare module 'worker_threads' {
  // eslint-disable-next-line no-shadow
  interface WorkerOptions {
    argv?: string[];
  }
}

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

type CatchableResult = Promise<ExecutionResult> & { catchAsResult(): Promise<ExecutionResult> };

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
  stdin?: string | Buffer | NodeJS.ReadableStream;
  /**
   * Entry file, only relevant to `.forkEntry` and `.workerEntry`
   */
  entry?: string;
}

/**
 * Standard utilities for managing executions
 */
export class ExecUtil {
  /**
   * Get standard execution options
   * @param opts The options to build out
   */
  static getOpts(opts: ExecutionOptions) {
    return {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      cwd: PathUtil.cwd,
      shell: false,
      ...opts,
      env: {
        ...process.env,
        ...(opts.env ?? {})
      }
    } as ExecutionOptions;
  }

  /**
   * Take a child process, and some additional options, and produce a promise that
   * represents the entire execution.  On successful completion the promise will resolve, and
   * on failed completion the promise will reject.
   *
   * @param p The process to enhance
   * @param options The options to use to ehance the process
   * @param cmd The command being run
   */
  static enhanceProcess(p: ChildProcess, options: ExecutionOptions, cmd: string): CatchableResult {
    const timeout = options.timeout;

    const prom = new Promise<ExecutionResult>((resolve, reject) => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let timer: NodeJS.Timeout;
      let done = false;
      const finish = function (result: Omit<ExecutionResult, 'stderr' | 'stdout'>) {
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
          const err = new Error(`Error executing ${cmd}: ${final.message || final.stderr || final.stdout || 'failed'}`);
          (err as unknown as { meta: ExecutionResult }).meta = final;
          reject(err);
        } else {
          resolve(final);
        }
      };

      if (!options.rawOutput) {
        if (p.stdout) {
          p.stdout!.on('data', (d: string | Buffer) => stdout.push(Buffer.from(d)));
        }
        if (p.stderr) {
          p.stderr!.on('data', (d: string | Buffer) => stderr.push(Buffer.from(d)));
        }
      }

      p.on('error', (err: Error) =>
        finish({ code: 1, message: err.message, valid: false }));

      p.on('close', (code: number) =>
        finish({ code, valid: code === null || code === 0 || code === 130 || code === 143 })); // Sigint/term

      if (timeout) {
        timer = setTimeout(async x => {
          p.kill('SIGKILL');
          finish({ code: 1, message: `Execution timed out after: ${timeout} ms`, valid: false, killed: true });
        }, timeout);
      }
    });

    const res = prom as CatchableResult;
    res.catchAsResult = () => res.catch(e => (e as { meta: ExecutionResult }).meta);
    return res;
  }

  /**
   * Run a command directly, as a stand alone operation
   * @param cmd The command to run
   * @param args The command line argumetns to pass
   * @param options The enhancement options
   */
  static spawn(cmd: string, args: string[] = [], options: ExecutionOptions = {}): ExecutionState<CatchableResult> {
    const p = spawn(cmd, args, this.getOpts(options));
    const result = this.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return { process: p, result };
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
    const p = spawn(process.argv0, [file, ...args], this.getOpts(options));
    const result = this.enhanceProcess(p, options, `${file} ${args.join(' ')}`);
    return { process: p, result };
  }

  /**
   * Run a travetto entry command relative to the current node executable.  Mimics how node's
   * fork operation is just spawn with the command set to `process.argv0`
   * @param cmd The file to run
   * @param args The command line arguments to pass
   * @param options The enhancement options
   */
  static forkEntry(file: string, args: string[] = [], options: ExecutionOptions = {}): ExecutionState<CatchableResult> {
    // Always register for the fork
    const opts = this.getOpts(options);
    file = file.replace(/[.]js$/, '.ts');
    const p = spawn(process.argv0, [require.resolve('../register'), file, ...args], opts);
    const result = this.enhanceProcess(p, options, `@travetto/boot/register ${file} ${args.join(' ')}`);
    return { process: p, result };
  }

  /**
   * Run a file as worker thread
   * @param file The file to run, if starts with @, will be resolved as a module
   * @param args The arguments to pass in
   * @param options The worker options
   */
  static worker<T = unknown>(file: string, args: string[] = [], options: WorkerOptions & { minimal?: boolean } = {}) {
    const worker = new Worker(file, {
      stderr: true,
      stdout: true,
      stdin: false,
      ...options,
      env: {
        ...process.env,
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

    const message = new Promise<T>((r, rej) => {
      worker.once('message', d => result.then(() => {
        if (d && 'stack' in d && 'message' in d) {
          const err = new Error(d['message']);
          err.stack = d['stack'];
          rej(err);
        } else {
          r(d);
        }
      }));
      result.catch(rej);
    });

    return { worker, message, result };
  }

  /**
   * Run a file as an enry worker thread
   * @param file The file to run, if starts with @, will be resolved as a module
   * @param args The arguments to pass in
   * @param options The worker options
   */
  static workerEntry<T = unknown>(file: string, args: string[] = [], options: WorkerOptions & { minimal?: boolean } = {}) {
    file = file.replace(/[.]js$/, '.ts');
    return this.worker<T>(require.resolve('../register'), [file, ...args], options);
  }

  /**
   * Execute command synchronously
   * @param cmd The cmd to run
   * @param args The arguments to pass
   */
  static execSync(cmd: string, args?: string[]) {
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
  static pipe(state: ExecutionState, input: string | NodeJS.ReadableStream): Promise<NodeJS.ReadableStream>;
  static async pipe(state: ExecutionState, input: Buffer | NodeJS.ReadableStream | string): Promise<Buffer | NodeJS.ReadableStream> {
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
   * Kill a spawned proces
   * @param proc The process to kill
   */
  static kill(proc: { kill(sig?: string | number): void }) {
    if (process.platform === 'win32') {
      proc.kill();
    } else {
      proc.kill('SIGTERM');
    }
  }
}