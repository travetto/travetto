import { Exec } from '@travetto/exec';
import { Env } from '@travetto/base';

import { SpawnConfig, ChildOptions } from './types';
import { ChildProcess } from 'child_process';

export class CommUtil {

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
      (finalOpts as any).shell = false;
    }

    const result = op(command, args, finalOpts);

    console.trace(`[${process.pid}] Launched ${result.process.pid}`);

    if (Env.debug) {
      result.process.stdout!.pipe(process.stdout);
      result.process.stderr!.pipe(process.stderr);
    }

    return result;
  }

  static killSpawnedProcess(proc: ChildProcess) {
    proc.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
  }
}