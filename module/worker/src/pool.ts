import * as os from 'os';
import * as gp from 'generic-pool';

import { ShutdownManager, TimeUtil } from '@travetto/base';

import { WorkSet } from './input/types';

/**
 * Worker definition
 */
export interface Worker<X> {
  active: boolean;
  id: unknown;
  init?(): Promise<unknown>;
  execute(input: X): Promise<unknown>;
  destroy(): Promise<void>;
  release?(): unknown;
}

/**
 * Work pool support
 */
export class WorkPool<X, T extends Worker<X>> {

  static DEFAULT_SIZE = Math.min(os.cpus().length - 1, 4);

  /**
   * Generic-pool pool
   */
  #pool: gp.Pool<T>;
  /**
   * Number of acquisitions in process
   */
  #pendingAcquires = 0;
  /**
   * List of errors during processing
   */
  #errors: Error[] = [];

  /**
   * Error count during creation
   */
  #createErrors = 0;

  /**
   *
   * @param getWorker Produces a new worker for the pool
   * @param opts Pool options
   */
  constructor(getWorker: () => Promise<T> | T, opts?: gp.Options) {
    const args = {
      max: WorkPool.DEFAULT_SIZE,
      min: 1,
      evictionRunIntervalMillis: 5000,
      ...(opts ?? {}),
    };

    // Create the pool
    this.#pool = gp.createPool({
      create: () => this.#createAndTrack(getWorker, args),
      destroy: x => this.destroy(x),
      validate: async (x: T) => x.active
    }, args);

    ShutdownManager.onShutdown(`worker.pool.${this.constructor.name}`, () => this.shutdown());
  }

  /**
   * Creates and tracks new worker
   */
  async #createAndTrack(getWorker: () => Promise<T> | T, opts: gp.Options): Promise<T> {
    try {
      this.#pendingAcquires += 1;
      const res = await getWorker();

      if (res.init) {
        await res.init();
      }

      this.#createErrors = 0; // Reset errors on success

      return res;
    } catch (err) {
      if (this.#createErrors++ > opts.max!) { // If error count is bigger than pool size, we broke
        console.error('Failed in creating pool', { error: err });
        process.exit(1);
      }
      throw err;
    } finally {
      this.#pendingAcquires -= 1;
    }
  }

  /**
   * Destroy the worker
   */
  async destroy(worker: T): Promise<void> {
    console.debug('Destroying', { pid: process.pid, worker: worker.id });
    return worker.destroy();
  }

  /**
   * Free worker on completion
   */
  async release(worker: T): Promise<void> {
    console.debug('Releasing', { pid: process.pid, worker: worker.id });
    try {
      if (worker.active) {
        if (worker.release) {
          try {
            await worker.release();
          } catch { }
        }
        await this.#pool.release(worker);
      } else {
        await this.#pool.destroy(worker);
      }
    } catch { }
  }

  /**
   * Process a given input source
   */
  async process(src: WorkSet<X>): Promise<void> {
    const pending = new Set<Promise<unknown>>();

    while (await src.hasNext()) {
      const worker = (await this.#pool.acquire())!;
      console.debug('Acquired', { pid: process.pid, worker: worker.id });
      const nextInput = await src.next();

      const completion = worker.execute(nextInput)
        .catch(err => this.#errors.push(err)) // Catch error
        .finally(() => this.release(worker));

      completion.finally(() => pending.delete(completion));

      pending.add(completion);
    }

    await Promise.all(Array.from(pending));

    if (this.#errors.length) {
      throw this.#errors[0];
    }
  }

  /**
   * Shutdown pool
   */
  async shutdown(): Promise<void> {
    while (this.#pendingAcquires) {
      await TimeUtil.wait(10);
    }
    await this.#pool.drain();
    await this.#pool.clear();
  }
}
