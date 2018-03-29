import * as child_process from 'child_process';
import { fork } from '@travetto/util';

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

    const [sub, forked] = fork(this.command, {
      env: {
        ...process.env,
      },
      quiet: true,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    this.process = sub;

    if (process.env.DEBUG) {
      this.process.stdout.pipe(process.stdout);
      this.process.stderr.pipe(process.stderr);
    }

    this.listenOnce('ready', e => this.send('init'));

    forked.catch(async (err: Error) => {
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
  listen(first: ((data: any) => void) | string, second?: (data: any) => void): void {
    if (typeof first === 'string' && second) {
      const eventType = first;
      const callback = second;

      this.process.on('message', event => {
        if (event.type === eventType) {
          callback(event);
        }
      });
    } else if (typeof first !== 'string') {
      const callback = first;
      this.process.on('message', callback);
    }
  }

  listenOnce(eventType: string, callback: (data: any) => void) {
    const fn = (event: any) => {
      if (event.type === eventType) {
        this.process.removeListener('message', fn);
        callback(event);
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
