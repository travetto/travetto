import * as os from 'os';
import * as gp from 'generic-pool';

import { ShutdownManager } from '@travetto/base';

import { InputSource } from './input/types';

/**
 * Worker definition
 */
export interface Worker<X> {
  active: boolean;
  id: any;
  init?(): Promise<any>;
  execute(input: X): Promise<any>;
  destroy(): Promise<any>;
  release?(): any;
}

/**
 * Work pool support
 */
export class WorkPool<X, T extends Worker<X>> {

  static DEFAULT_SIZE = Math.min(os.cpus().length - 1, 4);

  /**
   * Generic-pool pool
   */
  private pool: gp.Pool<T>;
  /**
   * Number of acquisitions in process
   */
  private pendingAcquires = 0;
  /**
   * List of errors during processing
   */
  private errors: Error[] = [];

  /**
   * Error count during creation
   */
  private createErrors = 0;

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
    this.pool = gp.createPool({
      create: () => this.createAndTrack(getWorker, args),
      destroy: x => this.destroy(x),
      validate: async (x: T) => x.active
    }, args);

    ShutdownManager.onShutdown(`worker.pool.${this.constructor.name}`, () => this.shutdown());
  }


  /**
   * Creates and tracks new worker
   */
  async createAndTrack(getWorker: () => Promise<T> | T, opts: gp.Options) {
    try {
      this.pendingAcquires += 1;
      const res = await getWorker();

      if (res.init) {
        await res.init();
      }

      this.createErrors = 0; // Reset errors on success

      return res;
    } catch (e) {
      if (this.createErrors++ > opts.max!) { // If error count is bigger than pool size, we broke
        console.error('Failed in creating pool', { error: e });
        process.exit(1);
      }
      throw e;
    } finally {
      this.pendingAcquires -= 1;
    }
  }

  /**
   * Destroy the worker
   */
  async destroy(worker: T) {
    console.debug('Destroying', { pid: process.pid, worker: worker.id });
    return worker.destroy();
  }

  /**
   * Free worker on completion
   */
  async release(worker: T) {
    console.debug('Releasing', { pid: process.pid, worker: worker.id });
    try {
      if (worker.active) {
        if (worker.release) {
          try {
            await worker.release();
          } catch { }
        }
        await this.pool.release(worker);
      } else {
        await this.pool.destroy(worker);
      }
    } catch { }
  }

  /**
   * Process a given input source
   */
  async process(src: InputSource<X>) {
    const pending = new Set<Promise<any>>();

    while (await src.hasNext()) {
      const worker = (await this.pool.acquire())!;
      console.debug('Acquired', { pid: process.pid, worker: worker.id });
      const nextInput = await src.next();

      const completion = worker.execute(nextInput)
        .catch(err => this.errors.push(err)) // Catch error
        .finally(() => this.release(worker));

      completion.finally(() => pending.delete(completion));

      pending.add(completion);
    }

    await Promise.all(Array.from(pending));

    if (this.errors.length) {
      throw this.errors[0];
    }
  }

  /**
   * Shutdown pool
   */
  async shutdown() {
    while (this.pendingAcquires) {
      await new Promise(r => setTimeout(r, 10));
    }
    await this.pool.drain();
    await this.pool.clear();
  }
}
