import * as cp from 'child_process';
import { AppError } from '@travetto/base';

import { ExecutionOptions, ExecutionResult } from './types';

export type WithOpts<T> = T & ExecutionOptions;

export class ExecUtil {

  private static getArgs(cmd: string) {
    let args: string[] = [];

    if (cmd.indexOf(' ') > 0) {
      [cmd, ...args] = cmd.split(' ');
    }

    console.debug('exec:', [cmd, ...args].join(' '));
    return { cmd, args };
  }

  static enhanceProcess(p: cp.ChildProcess, options: ExecutionOptions, cmd: string) {
    const timeout = options.timeout;

    const prom = new Promise<ExecutionResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timer: any;
      let done = false;
      const finish = async function (result: ExecutionResult) {
        if (done) {
          return;
        }
        if (timer) {
          clearTimeout(timer);
        }
        done = true;

        if (!result.valid) {
          reject(new AppError(`Error executing ${cmd}: ${result.message || result.stderr || result.stdout || 'failed'}`, result));
        } else {
          resolve(result);
        }
      };

      if (!options.quiet) {
        p.stdout.on('data', (d: string) => stdout += `${d}\n`);
        p.stderr.on('data', (d: string) => stderr += `${d}\n`);
      }

      p.on('error', (err: Error) =>
        finish({ code: 1, stdout, stderr, message: err.message, valid: false }));

      p.on('close', (code: number) =>
        finish({ code, stdout, stderr, valid: code === null || code === 0 || code === 130 || code === 143 })); // Sigint/term

      if (timeout) {
        timer = setTimeout(async x => {
          if (options.timeoutKill) {
            await options.timeoutKill(p);
          } else {
            p.kill('SIGKILL');
          }
          finish({ code: 1, stderr, stdout, message: `Execution timed out after: ${timeout} ms`, valid: false, killed: true });
        }, timeout);
      }
    });

    return prom;
  }

  static spawn(cmd: string, args: string[], options: WithOpts<cp.SpawnOptions> = {}): [cp.ChildProcess, Promise<ExecutionResult>] {
    args = args.map(x => `${x}`);
    const p = cp.spawn(cmd, args, { shell: true, ...(options as cp.SpawnOptions) });
    return [p, ExecUtil.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`)];
  }

  static fork(cmd: string, args: string[], options: WithOpts<cp.ForkOptions> = {}): [cp.ChildProcess, Promise<ExecutionResult>] {
    args = args.map(x => `${x}`);
    const p = cp.fork(cmd, args, options);
    return [p, ExecUtil.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`)];
  }

  static exec(cmd: string, args: string[], options: WithOpts<cp.ExecOptions> = {}): [cp.ChildProcess, Promise<ExecutionResult>] {
    args = args.map(x => `${x}`);
    const cmdStr = `${cmd} ${args.join(' ')}`;
    const p = cp.exec(cmdStr, options);
    return [p, ExecUtil.enhanceProcess(p, options, cmdStr)];
  }

  static serializeError(e: Error | any) {
    let error: any = undefined;

    if (e) {
      error = {};
      for (const k of Object.keys(e)) {
        error[k] = e[k];
      }
      error.$ = true;
      error.message = e.message;
      error.stack = e.stack;
      error.name = e.name;
    }

    return error;
  }

  static deserializeError(e: any) {
    if (e && e.$) {
      const err = new Error();
      for (const k of Object.keys(e)) {
        (err as any)[k] = e[k];
      }
      err.message = e.message;
      err.stack = e.stack;
      err.name = e.name;
      return err;
    } else if (e) {
      return e;
    }
  }
}