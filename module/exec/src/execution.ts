import { CommonProcess, ExecutionEvent } from './types';

export class Execution<U extends ExecutionEvent = ExecutionEvent, T extends CommonProcess = CommonProcess> {

  public _proc: T;

  constructor(proc?: T) {
    if (proc) {
      this._proc = proc;
    }
  }

  _init(): T {
    if (!this._proc) {
      throw new Error('Process not defined');
    }
    return this._proc;
  }

  init() {
    if (this._proc) {
      return false;
    }

    this._proc = this._init();

    return true;
  }

  send(eventType: string, data?: any) {
    if (process.env.DEBUG) {
      console.log(process.pid, 'SENDING', eventType, data);
    }
    if (this._proc.send) {
      this._proc.send({ type: eventType, ...(data || {}) });
    } else {
      throw new Error('this._proc.send was not defined');
    }
  }

  listenOnce(eventType: string): Promise<U>;
  listenOnce(eventType: string, callback: (e: U) => any): void;
  listenOnce(eventType: string, callback?: (e: U) => any) {
    if (callback) {
      return this.listenFor(eventType, (d, kill) => {
        kill!();
        callback(d);
      });
    } else {
      return new Promise(resolve => {
        this.listenFor(eventType, (d, kill) => {
          kill!();
          resolve(d);
        })
      });
    }
  }

  removeListener(fn: (e: U) => any) {
    this._proc.removeListener('message', fn);
  }

  listenFor(eventType: string, callback: (e: U, complete?: Function) => any) {
    let kill: Function;
    const fn = (event: U) => {
      if (event.type === eventType) {
        callback(event, kill);
      }
    };
    kill = this.listen(fn);
  }

  listen(handler: (e: U, complete?: Function) => any) {
    const kill = () => {
      this.removeListener(fn);
    };
    const fn = (e: U) => {
      if (process.env.DEBUG) {
        console.log(process.pid, 'RECEIVING', e.type, e);
      }

      let res;
      try {
        res = handler(e, kill);
        if (res.catch) {
          res.catch(kill);
        }
      } catch (e) {
        kill();
      }
    };

    this._proc.on('message', fn);

    return kill;
  }

  kill() {
  }

  clean() {
    if (this._proc) {
      this._proc.removeAllListeners('message');
    }
  }
}