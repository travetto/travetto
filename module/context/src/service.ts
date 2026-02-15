import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@travetto/di';
import { RuntimeError, AsyncQueue, castTo } from '@travetto/runtime';

type Ctx<T = unknown> = Record<string | symbol, T>;

/**
 * Async context using `asyncHooks`
 */
@Injectable()
export class AsyncContext {

  storage = new AsyncLocalStorage<Ctx>();

  constructor() {
    this.run = this.run.bind(this);
    this.iterate = this.iterate.bind(this);
  }

  #get<T = unknown>(): Ctx<T> {
    const store = this.storage.getStore();
    if (!store) {
      throw new RuntimeError('Context is not initialized');
    }
    return castTo(store);
  }

  /**
   * Are we in an active context
   */
  get active(): boolean {
    return this.storage.getStore() !== undefined;
  }

  /**
   * Get context field by key
   */
  get<T = unknown>(key: string | symbol): T | undefined {
    return this.#get<T>()[key];
  }

  /**
   * Set context field by key
   */
  set<T = unknown>(key: string | symbol, value: T | undefined): void {
    this.#get()[key] = value;
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
    return this.storage.run({ ...this.storage.getStore(), ...init }, fn);
  }

  /**
   * Run an async function and ensure the context is available during execution
   */
  iterate<T>(fn: () => AsyncIterable<T>, init: Ctx = {}): AsyncIterable<T> {
    const out = new AsyncQueue<T>();
    this.storage.run({ ...this.storage.getStore(), ...init }, async () => {
      try {
        for await (const item of fn()) {
          out.add(item);
        }
        out.close();
      } catch (error) {
        out.throw(castTo(error));
      }
    });
    return out;
  }
}