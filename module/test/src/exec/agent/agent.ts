import * as child_process from 'child_process';
import { exec } from '@travetto/util';

export class Agent {
  process: child_process.ChildProcess;
  completion: Promise<any>;
  _init: Promise<any>;

  stdout: string = '';
  stderr: string = '';

  constructor(public id: number, public command: string) {
  }

  async init() {
    if (this._init) {
      return this._init;
    }

    let [spawned, sub] = exec(this.command, {
      env: {
        ...process.env,
      },
      quiet: true,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      exposeProcess: true
    });

    this.process = sub;

    if (process.env.DEBUG) {
      this.process.stdout.pipe(process.stdout);
      this.process.stderr.pipe(process.stderr);
    }

    this.listenOnce('ready', e => this.send('init'));

    spawned.catch(async err => {
      console.error('Runner died, error ', err, '.  Reinitializing');
      delete this._init;
    });

    this._init = new Promise((resolve, reject) => {
      this.listenOnce('initComplete', () => resolve(true));
    });

    return this._init;
  }

  send(type: string, args: object = {}) {
    this.process.send({
      type,
      ...args
    });
  }

  listen(callback: (data: any) => void): void;
  listen(type: string, callback: (data: any) => void): void;
  listen(a: ((data: any) => void) | string, b?: (data: any) => void): void {
    if (typeof a === 'string' && b) {
      this.process.on('message', e => {
        if (e.type === a) {
          b(e);
        }
      });
    } else if (typeof a !== 'string') {
      this.process.on('message', a);
    }
  }

  listenOnce(type: string, callback: (data: any) => void) {
    let fn = (e: any) => {
      if (e.type === type) {
        this.process.removeListener('message', fn);
        callback(e);
      }
    };
    this.process.on('message', fn);
  }

  removeListener(listener: (...args: any[]) => void) {
    this.process.removeListener('message', listener);
  }

  clean() {
    this.process.removeAllListeners('message');
    this.stdout = '';
    this.stderr = '';
    delete this.completion;
  }
}
