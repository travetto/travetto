import * as child_process from 'child_process';
import * as exec from './util';
import { CommonProcess, ChildOptions, ExecutionEvent } from './types';
import { Execution } from './execution';

export class ChildExecution<U extends ExecutionEvent = ExecutionEvent> extends Execution<U, child_process.ChildProcess> {

  constructor(public command: string, public fork = false, public opts: ChildOptions = {}) {
    super();
  }

  _init() {
    const op: typeof exec.fork = (this.fork ? exec.fork : exec.spawn);

    const finalOpts: ChildOptions = {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      ...this.opts,
      env: {
        ...this.opts.env || {},
        ...process.env,
        EXECUTION: true
      }
    };

    const [sub, complete] = op(this.command, finalOpts);

    if (process.env.DEBUG) {
      sub.stdout.pipe(process.stdout);
      sub.stderr.pipe(process.stderr);
    }

    complete.then(x => {
      delete this._proc;
    });

    return sub;
  }

  async waitForComplete() {
    await this._init();
    return new Promise((resolve, reject) => {
      this._proc.on('close', () => {
        resolve();
      });
      this._proc.on('exit', () => {
        resolve();
      });
      this._proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  kill() {
    if (this._proc) {
      this._proc.kill('SIGKILL');
    }
    super.kill();
  }
}
