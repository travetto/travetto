import * as child_process from 'child_process';

import { Env } from '@travetto/base';
import { Exec, ExecutionResult } from '@travetto/exec';

import { ChildOptions, WorkerEvent } from './types';
import { Execution } from './execution';

export class Worker<U extends WorkerEvent = WorkerEvent> extends Execution<U, child_process.ChildProcess> {

  private _complete: Promise<ExecutionResult>;

  constructor(public command: string, public args: string[], public fork = false, public opts: ChildOptions = {}) {
    super();
  }

  _init() {
    const op: typeof Exec.fork = (this.fork && process.platform !== 'win32' ? Exec.fork : Exec.spawn);

    const finalOpts: ChildOptions = {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      ...this.opts,
      env: {
        ...this.opts.env || {},
        ...process.env,
        EXECUTION: true
      }
    };

    if (this.fork && op === Exec.spawn) {
      this.args.unshift(this.command);
      this.command = process.argv0;
      (finalOpts as any).shell = false;
    }

    const { process: sub, result: complete } = op(this.command, this.args, finalOpts);

    console.trace(`[${process.pid}] Launched ${sub.pid}`);

    if (Env.isTrue('DEBUG')) {
      sub.stdout.pipe(process.stdout);
      sub.stderr.pipe(process.stderr);
    }

    complete.then(x => {
      delete this._proc;
    });

    this._complete = complete;

    return sub;
  }

  async kill() {
    if (this._proc) {
      this._proc.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
      await this._complete;
    }

    super.kill();
  }
}
