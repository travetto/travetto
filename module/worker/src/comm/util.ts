import { ChildProcess, SpawnOptions } from 'child_process';

import { Exec } from '@travetto/exec';
import { Env } from '@travetto/base';

import { SpawnConfig, ChildOptions } from './types';

type ErrorShape = { $?: any, message: string, stack?: string, name: string, toConsole?: any };

// TODO: Document
export class CommUtil {

  static serializeError(e: Error | ErrorShape): ErrorShape;
  static serializeError(e: undefined): undefined;
  static serializeError(e: Error | ErrorShape | undefined) {
    let error: ErrorShape | undefined;

    if (e) {
      error = {} as ErrorShape;
      for (const k of Object.keys(e) as (keyof ErrorShape)[]) {
        error[k] = (e as ErrorShape)[k];
      }
      error.$ = true;
      error.message = e.message;
      error.stack = e.stack;
      error.name = e.name;
    }

    return error;
  }

  static deserializeError(e: Error | ErrorShape): Error;
  static deserializeError(e: undefined): undefined;
  static deserializeError(e: Error | ErrorShape | undefined) {
    if (e && '$' in e) {
      const err = new Error();
      for (const k of Object.keys(e) as (keyof typeof err)[]) {
        err[k] = e[k];
      }
      err.message = e.message;
      err.stack = e.stack;
      err.name = e.name;
      return err;
    } else if (e) {
      return e;
    }
  }

  static spawnProcess(config: SpawnConfig) {
    let { opts, command, fork, args } = config;
    opts = opts ?? {};
    args = args ?? [];
    fork = fork === undefined ? false : fork;

    const op: typeof Exec.fork = (fork && process.platform !== 'win32' ? Exec.fork : Exec.spawn);

    const finalOpts: ChildOptions = {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      ...opts,
      env: {
        ...opts.env ?? {},
        ...process.env,
        EXECUTION: true
      }
    };

    if (fork && op === Exec.spawn) {
      args.unshift(command);
      command = process.argv0;
      (finalOpts as SpawnOptions).shell = false;
    }

    const result = op.call(Exec, command, args, finalOpts);

    console.trace(`[${process.pid}] Launched ${result.process.pid}`);

    if (Env.debug) {
      result.process.stdout!.pipe(process.stdout);
      result.process.stderr!.pipe(process.stderr);
    }

    return result;
  }

  static killSpawnedProcess(proc: ChildProcess) {
    if (process.platform === 'win32') {
      proc.kill();
    } else {
      proc.kill('SIGTERM');
    }
  }
}