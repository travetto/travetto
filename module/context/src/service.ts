import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@travetto/di';
import { AppError, AsyncQueue, castTo } from '@travetto/runtime';

type Ctx<T = unknown> = Record<string | symbol, T>;

/**
 * Async context using `asyncHooks`
 */
@Injectable()
export class AsyncContext {

  alStorage = new AsyncLocalStorage<Ctx>();

  constructor() {
    this.run = this.run.bind(this);
    this.iterate = this.iterate.bind(this);
  }

  #get<T = unknown>(): Ctx<T> {
    if (!this.active) {
      throw new AppError('Context is not initialized');
    }
    return castTo(this.alStorage.getStore());
  }

  /**
   * Are we in an active context
   */
  get active(): boolean {
    return this.alStorage.getStore() !== undefined;
  }

  /**
   * Get context field by key
   */
  get<T = unknown>(key: string | symbol, ignoreErrors = false): T | undefined {
    if (ignoreErrors && !this.active) {
      return;
    }
    return this.#get<T>()[key];
  }

  /**
   * Set context field by key
   */
  set<T = unknown>(key: string | symbol, val: T | undefined, ignoreErrors = false): void {
    if (ignoreErrors && !this.active) {
      return;
    }
    this.#get()[key] = val;
  }

  /**
   * Get entire context
   * @private
   */
  copy<T = unknown>(): Ctx<T> {
    return structuredClone(this.#get<T>());
  }

  /**
   * Run an async function and ensure the context is available during execution
   */
  async run<T = unknown>(fn: () => Promise<T> | T, init: Ctx = {}): Promise<T> {
    return this.alStorage.run({ ...this.alStorage.getStore(), ...init }, fn);
  }

  /**
   * Run an async function and ensure the context is available during execution
   */
  iterate<T>(fn: () => AsyncIterable<T>, init: Ctx = {}): AsyncIterable<T> {
    const out = new AsyncQueue<T>();
    this.alStorage.run({ ...this.alStorage.getStore(), ...init }, async () => {
      try {
        for await (const item of fn()) {
          out.add(item);
        }
        out.close();
      } catch (err) {
        out.throw(castTo(err));
      }
    });
    return out;
  }
}