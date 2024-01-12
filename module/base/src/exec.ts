import { ChildProcess } from 'node:child_process';

const MINUTE = (1000 * 60);

const RESULT = Symbol.for('@travetto/base:exec-result');

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
 * Standard utilities for managing executions
 */
export class ExecUtil {

  static RESTART_EXIT_CODE = 200;

  /**
   * Run with automatic restart support
   * @param cmd The command to run
   * @param args The command line arguments to pass
   * @param options The enhancement options
   */
  static async withRestart(run: () => ChildProcess, maxRetriesPerMinute?: number): Promise<ExecutionResult> {
    const maxRetries = maxRetriesPerMinute ?? 5;
    const restarts: number[] = [];

    process.once('disconnect', () => process.exit());

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
  static getResult(
    proc: ChildProcess & { [RESULT]?: Record<string, Promise<ExecutionResult>> },
    options: { catch?: boolean, stdout?: boolean, stderr?: boolean } = {}
  ): Promise<ExecutionResult> {
    const res = (proc[RESULT] ??= {})[`${options.stdout}|${options.stderr}`] ??= new Promise<ExecutionResult>(resolve => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let done = false;
      const finish = function (result: Omit<ExecutionResult, 'stderr' | 'stdout'>): void {
        if (done) {
          return;
        }
        done = true;

        const final = {
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
          ...result
        };

        resolve(!final.valid ?
          { ...final, message: `${final.message || final.stderr || final.stdout || 'failed'}` } :
          final
        );
      };
      if (options.stdout !== false) {
        proc.stdout?.on('data', (d: string | Buffer) => stdout.push(Buffer.from(d)));
      }
      if (options.stderr !== false) {
        proc.stderr?.on('data', (d: string | Buffer) => stderr.push(Buffer.from(d)));
      }

      proc.on('error', (err: Error) =>
        finish({ code: 1, message: err.message, valid: false }));

      proc.on('close', (code: number) =>
        finish({ code, valid: code === null || code === 0 }));
    });

    return options.catch ? res : res.then(v => {
      if (v.valid) {
        return v;
      } else {
        throw new Error(v.message);
      }
    });
  }
}