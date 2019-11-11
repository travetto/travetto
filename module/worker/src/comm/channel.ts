import { ChildProcess } from 'child_process';

import { Env } from '@travetto/base';

import { CommEvent } from './types';

export class ProcessCommChannel<T extends NodeJS.Process | ChildProcess, U extends CommEvent = CommEvent> {

  public proc: T;

  constructor(proc: T) {
    this.proc = proc;
    console.trace(`[${this.id}] Constructed Execution`);
  }

  private get parentId() {
    return process.pid;
  }

  get id() {
    return this.proc && this.proc.pid;
  }

  get active() {
    return !!this.proc;
  }

  send(eventType: string, data?: any) {
    if (Env.trace) {
      console.trace(`[${this.parentId}] Sending [${this.id}] ${eventType}`);
    }
    if (this.proc.send) {
      this.proc.send({ type: eventType, ...(data ?? {}) });
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
    this.proc.removeListener('message', fn);
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
        console.trace(`[${this.parentId}] Received [${this.id}] ${e.type}`);
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

    this.proc.on('message', fn);

    return kill;
  }

  async destroy() {
    if (this.proc) {
      console.trace(`[${this.parentId}] Killing [${this.id}]`);
    }
    this.release();
    delete this.proc;
  }

  release() {
    if (this.proc) {
      console.trace(`[${this.parentId}] Released [${this.id}]`);
      this.proc.removeAllListeners('message');
    }
  }
}