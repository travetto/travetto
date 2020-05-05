import { ChildProcess, SpawnOptions, spawn, execSync } from 'child_process';

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
   * Built in timeout for any execution
   */
  timeout?: number;
  /**
   * Whether or not to collect stdin/stdout
   */
  quiet?: boolean;
  /**
   * The stdin source for the execution
   */
  stdin?: string | Buffer | NodeJS.ReadableStream;
  /**
   * Exit on completion, with the appropriate exit code
   */
  exitOnComplete?: boolean;
  /**
   * When timeout occurs, kill using this method in lieu of a direct kill invocation
   */
  killOnTimeout?: (proc: ChildProcess) => Promise<void>;
}

/**
 * Standard utilities for managing executions
 */
export class ExecUtil {
  /**
   * Get standard execution options
   */
  static getOpts(opts: ExecutionOptions) {
    return {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      cwd: process.cwd(),
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
   */
  static enhanceProcess(p: ChildProcess, options: ExecutionOptions, cmd: string) {
    const timeout = options.timeout;

    const prom = new Promise<ExecutionResult>((resolve, reject) => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let timer: any;
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

        if (options.exitOnComplete) {
          process.exit(final.code);
        } else if (!final.valid) {
          const err = new Error(`Error executing ${cmd}: ${final.message || final.stderr || final.stdout || 'failed'}`);
          (err as any).meta = final;
          reject(err);
        } else {
          resolve(final);
        }
      };

      if (!options.quiet) {
        if (p.stdout) {
          p.stdout!.on('data', (d: string) => stdout.push(Buffer.from(d)));
        }
        if (p.stderr) {
          p.stderr!.on('data', (d: string) => stderr.push(Buffer.from(d)));
        }
      }

      p.on('error', (err: Error) =>
        finish({ code: 1, message: err.message, valid: false }));

      p.on('close', (code: number) =>
        finish({ code, valid: code === null || code === 0 || code === 130 || code === 143 })); // Sigint/term

      if (timeout) {
        timer = setTimeout(async x => {
          if (options.killOnTimeout) {
            await options.killOnTimeout(p);
          } else {
            p.kill('SIGKILL');
          }
          finish({ code: 1, message: `Execution timed out after: ${timeout} ms`, valid: false, killed: true });
        }, timeout);
      }
    });

    return prom;
  }

  /**
   * Run a command directly, as a stand alone operation
   */
  static spawn(cmd: string, args: string[] = [], options: ExecutionOptions = {}): ExecutionState {
    const p = spawn(cmd, args, this.getOpts(options));
    const result = this.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return { process: p, result };
  }

  /**
   * Run a command relative to the current node executable.  Mimics how node's
   * fork operation is just spawn with the command set to `process.argv0`
   */
  static fork(cmd: string, args: string[] = [], options: ExecutionOptions = {}): ExecutionState {
    const p = spawn(process.argv0, [cmd, ...args], this.getOpts(options));
    const result = this.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return { process: p, result };
  }

  /**
   * Execute command synchronously
   */
  static execSync(command: string) {
    return execSync(command, { stdio: ['pipe', 'pipe'] }).toString().trim();
  }

  /**
   * Platform aware file opening
   */
  static launch(path: string) {
    const op = process.platform === 'darwin' ? ['open', path] :
      process.platform === 'win32' ? ['cmd', '/c', 'start', path] :
        ['xdg-open', path];

    this.spawn(op[0], op.slice(1));
  }
}