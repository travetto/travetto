import * as child_process from 'child_process';
import * as spawn from 'cross-spawn';
import { Worker } from '.';

export class SpawnedWorker<U = any> extends Worker<U, child_process.ChildProcess> {
  constructor(private script: string, private args?: any[], private env?: object, private cwd?: string) {
    super(new Promise((resolve, reject) => {
      const sub = spawn(`${cwd}/${script}`, args || [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        cwd: cwd || process.cwd(),
        env: { ...(env || {}), WORKER: true }
      });

      sub.stdout.on('data', d => console.log(d.toString()));
      sub.stderr.on('data', d => console.error(d.toString()));
      return sub;
    }));

  }

  async init() {
    const res = await super.init();
    if (res) {
      this._proc.on('close', code => {
        console.log('Closed', code);
        delete this._proc;
      });
    }
    return res;
  }

  kill() {
    if (this._proc) {
      this._proc.kill('SIGKILL');
    }
  }
}
