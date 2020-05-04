import * as asyncHooks from 'async_hooks';

import { Injectable } from '@travetto/di';
import { AppError } from '@travetto/base';

/**
 * Async context using `asyncHooks`
 */
@Injectable()
export class AsyncContext {
  private threads = new Map<number, number>();
  private threadsSet = new Map<number, Set<number>>();
  private hooks: asyncHooks.AsyncHook;
  private active = 0;

  storageState = new Map<number, any>();

  constructor() {
    this.hooks = asyncHooks.createHook({
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
    const currId = asyncHooks.executionAsyncId();
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
    if (!this.active) {
      return;
    }
    const exAsyncId = asyncHooks.executionAsyncId();
    const triggerId = asyncHooks.triggerAsyncId() || asyncId;
    const target = this.threads.get(triggerId) || this.threads.get(exAsyncId);
    if (target) {
      this.threads.set(asyncId, target);
      this.threadsSet.get(target)!.add(asyncId);
    }
  }

  private leave(asyncId: number) {
    if (!this.active) {
      return;
    }

    if (this.threads.has(asyncId)) {
      this.threads.delete(asyncId);
    } else {
      const exAsyncId = asyncHooks.executionAsyncId();
      if (this.threads.has(exAsyncId)) {
        this.threads.delete(exAsyncId);
      }
    }
  }

  /**
   * Clear the context entirely or just for a given key
   */
  clear(key?: string | symbol) {
    if (key) {
      const obj = this.storage();
      delete obj[key];
    } else {
      this.storage({});
    }
  }

  /**
   * Get entire context or a portion by key
   */
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

  /**
   * Set entire context or a portion by key
   */
  set(key: string | symbol, val: any): void;
  set(val: any): void;
  set(keyOrVal: string | symbol, valWithKey?: any) {
    if (valWithKey) {
      this.get()[keyOrVal] = valWithKey;
    } else {
      this.storage(keyOrVal);
    }
  }

  /**
   * Run an async function and ensure the context is available during execution
   */
  async run(fn: () => Promise<any>, init: any = {}) {
    if (!this.active) {
      this.hooks.enable();
    }

    // Force new context
    await new Promise(process.nextTick);

    const runId = asyncHooks.executionAsyncId() || asyncHooks.triggerAsyncId();
    const threads = new Set([runId]);

    this.active += 1;
    this.storageState.set(runId, init);
    this.threadsSet.set(runId, threads);
    this.threads.set(runId, runId);

    let val;
    let err;
    try {
      val = await fn();
    } catch (e) {
      err = e;
    }

    this.active -= 1;
    this.storageState.delete(runId);
    this.threadsSet.delete(runId);

    for (const el of threads) {
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