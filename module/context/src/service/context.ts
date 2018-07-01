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

    this.run = this.run.bind(this);
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
    if (this.threads.has(asyncId)) {
      this.threads.delete(asyncId);
    } else if (this.threads.has(exAsyncId)) {
      this.threads.delete(exAsyncId);
    }
  }

  _storage(val: any): void;
  _storage(): any;
  _storage(val?: any) {
    const currId = async_hooks.executionAsyncId();
    const key = this.threads.get(currId)!;
    if (val) {
      this.storage.set(key, val);
    } else {
      let obj = this.storage.get(key);
      if (!obj) {
        obj = {};
        this._storage(obj = {});
      }
      return obj;
    }
  }

  clear() {
    const obj = this._storage();
    const keys = Object.keys(obj);
    for (const k of keys) {
      delete obj[k];
    }
  }

  get = () => this._storage();
  set = (val: any) => this._storage(val);

  async run(fn: () => Promise<any>, init: any = {}) {
    if (!this.active) {
      this.hooks.enable();
    }

    // Force new context
    await new Promise(r => process.nextTick(r));

    const runId = async_hooks.executionAsyncId() || async_hooks.triggerAsyncId();
    let val;
    let err;

    this.active += 1;
    this.storage.set(runId, init);
    this.threads.set(runId, runId);

    try {
      val = await fn();
    } catch (e) {
      require('fs').writeSync(1, e.stack);
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