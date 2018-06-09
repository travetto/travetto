import { Injectable } from '@travetto/di';
import * as async_hooks from 'async_hooks';

@Injectable()
export class Context {
  threads = new Map<number, number>();
  storage = new Map<number, any>();
  hooks: async_hooks.AsyncHook;

  constructor() {
    this.hooks = async_hooks.createHook({
      before: this.beforeHook.bind(this),
      init: this.initHook.bind(this),
      after: this.cleanup.bind(this),
      promiseResolve: this.cleanup.bind(this, false),
      destroy: this.cleanup.bind(this)
    });
  }

  start() {
    this.hooks.enable();
  }

  stop() {
    this.hooks.disable();
    this.threads.clear();
    this.storage.clear();
  }

  beforeHook(asyncId: number, type: string, triggerAsyncId: number) {
    // Top of stack
    const triggerId = async_hooks.triggerAsyncId() || asyncId;
    const exAid = async_hooks.executionAsyncId();
    const prev = this.threads.get(triggerId)!;
    if (prev) {
      this.threads.set(asyncId, prev);
    } else {
      this.threads.set(asyncId, triggerId);
      this.storage.set(triggerId, {});
    }
  }

  initHook(asyncId: number) {
    const exAsyncId = async_hooks.executionAsyncId();
    const triggerId = async_hooks.triggerAsyncId();
    const target = this.threads.get(triggerId)! || this.threads.get(exAsyncId)!;
    this.threads.set(asyncId, target);
  }

  cleanup(asyncId: number, threads = true) {
    this.storage.delete(asyncId);
    if (threads) {
      this.threads.delete(asyncId);
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
}