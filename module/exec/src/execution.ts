import { Env } from '@travetto/base';

import { CommonProcess, ExecutionEvent } from './types';

export class Execution<U extends ExecutionEvent = ExecutionEvent, T extends CommonProcess = CommonProcess> {

  public _proc: T;

  constructor(proc?: T) {
    if (proc) {
      this._proc = proc;
      console.trace(`[${proc.pid}] Constructed Execution`);
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

  get active() {
    return !!this._proc;
  }

  send(eventType: string, data?: any) {
    if (Env.trace) {
      console.trace(`[${process.pid}] Sending [${this._proc.pid}] ${eventType}`);
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
        });
      });
    }
  }

  removeListener(fn: (e: U) => any) {
    this._proc.removeListener('message', fn);
  }

  listenFor(eventType: string, callback: (e: U, complete: Function) => any) {
    const fn = (event: U, kill: Function) => {
      if (event.type === eventType) {
        callback(event, kill);
      }
    };
    this.listen(fn);
  }

  listen(handler: (e: U, complete: Function) => any) {
    let fn: (e: U) => void;
    const kill = (e?: any) => {
      this.removeListener(fn);
    };
    fn = (e: U) => {
      if (Env.trace) {
        console.trace(`[${process.pid}] Received [${this._proc.pid}] ${e.type}`);
      }

      let res;
      try {
        res = handler(e, kill);
        if (res && res.catch) {
          res.catch(kill);
        }
      } catch (e) {
        kill(e);
      }
    };

    this._proc.on('message', fn);

    return kill;
  }

  kill() {
    if (this._proc) {
      console.trace(`[${process.pid}] Killing [${this._proc.pid}]`);
    }
    this.release();
    delete this._proc;
  }

  get pid() {
    return this._proc && this._proc.pid;
  }

  release() {
    if (this._proc) {
      console.trace(`[${process.pid}] Released [${this._proc.pid}]`);
      this._proc.removeAllListeners('message');
    }
  }
}