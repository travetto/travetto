import * as child_process from 'child_process';
import * as exec from './util';;
import { CommonProcess } from './types';
import { Worker } from './worker';

export class ChildWorker<U = any> extends Worker<U, child_process.ChildProcess> {
  constructor(public command: string, fork = false) {
    super(new Promise((resolve) => {
      const op: typeof exec.fork = (fork ? exec.fork : exec.spawn);
      const [sub, complete] = op(this.command, {
        env: {
          ...process.env,
          WORKER: true
        },
        quiet: true,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });

      if (process.env.DEBUG) {
        sub.stdout.pipe(process.stdout);
        sub.stderr.pipe(process.stderr);
      }

      complete.then(x => {
        delete this._proc;
      });

      return sub;
    }))
  }

  kill() {
    if (this._proc) {
      this._proc.kill('SIGKILL');
    }
  }
}
