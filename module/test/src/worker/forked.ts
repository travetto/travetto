import * as child_process from 'child_process';
import { fork } from '@travetto/util';
import { CommonProcess } from './types';
import { Worker } from './worker';

export class ForkedWorker<U = any> extends Worker<U, child_process.ChildProcess> {
  constructor(public command: string) {
    super(new Promise((resolve) => {
      const [sub, forked] = fork(this.command, {
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
    }))
  }

  kill() {
    if (this._proc) {
      this._proc.kill('SIGKILL');
    }
  }
}
