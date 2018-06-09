import { Injectable } from '@travetto/di';
import * as async_hooks from 'async_hooks';

@Injectable()
export class Context {
  threads = new Map<number, number>();
  storage = new Map<number, any>();
  hooks: async_hooks.AsyncHook;
  active = 0;

  constructor() {
    this.hooks = async_hooks.createHook({
      before: this.enter.bind(this),
      init: this.enter.bind(this),
      after: this.leave.bind(this),
      promiseResolve: this.leave.bind(this),
      destroy: this.leave.bind(this)
    });
  }

  enter(asyncId: number) {
    const exAsyncId = async_hooks.executionAsyncId();
    const triggerId = async_hooks.triggerAsyncId() || asyncId;
    const target = this.threads.get(triggerId)! || this.threads.get(exAsyncId)!;
    if (target) {
      this.threads.set(asyncId, target);
    }
  }

  leave(asyncId: number) {
    const exAsyncId = async_hooks.executionAsyncId();
    if (this.threads.has(asyncId) || this.threads.has(exAsyncId)) {
      this.threads.delete(asyncId);
      this.threads.delete(exAsyncId);
    }
  }

  _storage() {
    const currId = async_hooks.executionAsyncId();
    const key = this.threads.get(currId)!;
    const obj = this.storage.get(key);
    return obj;
  }

  clear() {
    const obj = this._storage();
    const keys = Object.keys(obj);
    for (const k of keys) {
      delete obj[k];
    }
  }

  get(key: string): any {
    return this._storage()[key];
  }

  set(key: string, val: any) {
    this._storage()[key] = val;
  }

  async run(fn: () => Promise<any>, init: any = {}) {
    if (!this.active) {
      this.hooks.enable();
    }

    const runId = async_hooks.executionAsyncId();
    let val;
    let err;

    this.active += 1;
    this.storage.set(runId, init);
    this.threads.set(runId, runId);

    try {
      val = await fn();
    } catch (e) {
      err = e;
    }

    this.active -= 1;
    this.storage.delete(runId);
    this.threads.delete(runId);

    if (!this.active) {
      this.hooks.disable();
    }

    if (err) {
      throw err;
    } else {
      return val;
    }
  }
}