import * as async_hooks from 'async_hooks';

import { Injectable } from '@travetto/di';
import { AppError } from '@travetto/base';

@Injectable()
export class ContextService {
  private threads = new Map<number, number>();
  private threadsSet = new Map<number, Set<number>>();
  private hooks: async_hooks.AsyncHook;
  private active = 0;

  storageState = new Map<number, any>();

  constructor() {
    this.hooks = async_hooks.createHook({
      before: this.enter.bind(this),
      init: this.enter.bind(this),
      after: this.leave.bind(this),
      destroy: this.leave.bind(this)
    });

    this.run = this.run.bind(this);
  }

  private storage(val: any): void;
  private storage(): any;
  private storage(val?: any) {
    const currId = async_hooks.executionAsyncId();
    const key = this.threads.get(currId)!;
    if (!key) {
      throw new AppError('Context is not initialized', 'general');
    }
    if (val) {
      this.storageState.set(key, val);
    } else {
      let obj = this.storageState.get(key);
      if (!obj) {
        obj = {};
        this.storage(obj);
      }
      return obj;
    }
  }

  private enter(asyncId: number) {
    const exAsyncId = async_hooks.executionAsyncId();
    const triggerId = async_hooks.triggerAsyncId() || asyncId;
    const target = this.threads.get(triggerId) || this.threads.get(exAsyncId);
    if (target) {
      this.threads.set(asyncId, target);
      this.threadsSet.get(target)!.add(asyncId);
    }
  }

  private leave(asyncId: number) {
    const exAsyncId = async_hooks.executionAsyncId();
    if (this.threads.has(asyncId)) {
      this.threads.delete(asyncId);
    } else if (this.threads.has(exAsyncId)) {
      this.threads.delete(exAsyncId);
    }
  }

  clear(key?: string | symbol) {
    if (key) {
      const obj = this.storage();
      delete obj[key];
    } else {
      this.storage({});
    }
  }

  get<T = any>(key: string | symbol): T;
  get(): any;
  get<T>(key?: string | symbol) {
    const root = this.storage();
    if (key) {
      return root[key] || (root[key] = {}) as T;
    } else {
      return root as T;
    }
  }

  set(key: string | symbol, val: any): void;
  set(val: any): void;
  set(keyOrVal: string | symbol, valWithKey?: any) {
    if (valWithKey) {
      this.get()[keyOrVal] = valWithKey;
    } else {
      this.storage(keyOrVal);
    }
  }

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
    this.storageState.set(runId, init);
    this.threads.set(runId, runId);
    this.threadsSet.set(runId, new Set([runId]));

    try {
      val = await fn();
    } catch (e) {
      err = e;
    }

    this.active -= 1;
    this.storageState.delete(runId);
    for (const el of this.threadsSet.get(runId)!) {
      this.threads.delete(el);
    }

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