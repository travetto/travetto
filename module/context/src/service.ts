import * as asyncHooks from 'async_hooks';

import { Injectable } from '@travetto/di';
import { AppError } from '@travetto/base';

const { AsyncLocalStorage } = asyncHooks;

type Ctx = Record<string | symbol, any>;

/**
 * Async context using `asyncHooks`
 */
@Injectable()
export class AsyncContext {

  alStorage = new AsyncLocalStorage<{ value: Ctx }>();
  active = 0;

  constructor() {
    this.run = this.run.bind(this);
    this.iterate = this.iterate.bind(this);
  }

  private store(setAs?: Ctx | null) {
    const val = this.alStorage.getStore();
    if (!val) {
      throw new AppError('Context is not initialized', 'general');
    }
    if (setAs) {
      val.value = setAs;
    } else {
      if (!val.value) {
        val.value = {};
      }
    }
    return val.value;
  }

  /**
   * Get entire context or a portion by key
   */
  get<T = any>(key: string | symbol): T;
  get(): any;
  get<T>(key?: string | symbol) {
    const root = this.store();
    if (key) {
      return root[key as string];
    } else {
      return root as T;
    }
  }

  /**
   * Set entire context or a portion by key
   */
  set(key: string | symbol, val: any): void;
  set(val: Ctx): void;
  set(keyOrVal: string | symbol | Ctx, valWithKey?: any) {
    if (valWithKey) {
      this.get()[keyOrVal as string] = valWithKey;
    } else {
      this.store(keyOrVal as Ctx);
    }
  }

  /**
   * Run an async function and ensure the context is available during execution
   */
  async run(fn: () => Promise<any>, init: any = {}) {
    if (this.alStorage.getStore()) {
      init = { ...this.store(), ...init };
    }
    this.active += 1;
    this.alStorage.enterWith({ value: init });
    try {
      return await fn();
    } finally {
      // @ts-expect-error
      delete this.alStorage.getStore().value;
      if ((this.active -= 1) === 0) {
        this.alStorage.disable();
      }
    }
  }

  /**
   * Run an async function and ensure the context is available during execution
   */
  async * iterate(fn: () => AsyncGenerator<any>, init: any = {}) {
    if (this.alStorage.getStore()) {
      init = { ...this.store(), ...init };
    }
    this.active += 1;
    this.alStorage.enterWith({ value: init });
    try {
      return yield* fn();
    } finally {
      // @ts-expect-error
      delete this.alStorage.getStore().value;
      if ((this.active -= 1) === 0) {
        this.alStorage.disable();
      }
    }
  }
}