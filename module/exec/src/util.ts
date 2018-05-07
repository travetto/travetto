import * as cp from 'child_process';
import { ExecutionOptions, ExecutionResult } from './types';
import { scanDir, Entry } from '@travetto/base';

export function enhanceProcess(p: cp.ChildProcess, options: ExecutionOptions) {
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
        reject(result);
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
      finish({ code, stdout, stderr, valid: code === null || code === 0 }));

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

function getArgs(cmd: string) {
  let args: string[] = [];

  if (cmd.indexOf(' ') > 0) {
    [cmd, ...args] = cmd.split(' ');
  }

  console.debug('exec:', [cmd, ...args].join(' '));
  return { cmd, args };
}

export type WithOpts<T> = T & ExecutionOptions;

export function spawn(cmdStr: string, options: WithOpts<cp.SpawnOptions> = {}): [cp.ChildProcess, Promise<ExecutionResult>] {
  const { cmd, args } = getArgs(cmdStr);
  const p = cp.spawn(cmd, args, { shell: true, ...(options as cp.SpawnOptions) });
  return [p, enhanceProcess(p, options)];
}

export function fork(cmdStr: string, options: WithOpts<cp.ForkOptions> = {}): [cp.ChildProcess, Promise<ExecutionResult>] {
  const { cmd, args } = getArgs(cmdStr);
  const p = cp.fork(cmd, args, options);
  return [p, enhanceProcess(p, options)];
}

export function exec(cmd: string, options: WithOpts<cp.ExecOptions> = {}): [cp.ChildProcess, Promise<ExecutionResult>] {
  const p = cp.exec(cmd, options);
  return [p, enhanceProcess(p, options)];
}

export function serializeError(e: Error | any) {
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

export function deserializeError(e: any) {
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