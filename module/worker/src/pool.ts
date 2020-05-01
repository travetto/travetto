import * as os from 'os';
import * as gp from 'generic-pool';

import { ShutdownManager } from '@travetto/base';

import { InputSource } from './input/types';

// TODO: Document
export interface Worker<X> {
  active: boolean;
  id: any;
  init?(): Promise<any>;
  execute(input: X): Promise<any>;
  destroy(): Promise<any>;
  release?(): any;
}

// TODO: Document
export class WorkPool<X, T extends Worker<X>> {

  static DEFAULT_SIZE = Math.min(os.cpus().length - 1, 4);

  private pool: gp.Pool<T>;
  private pendingAcquires = 0;
  private errors: Error[] = [];

  constructor(getWorker: () => Promise<T> | T, opts?: gp.Options) {
    const args = {
      max: WorkPool.DEFAULT_SIZE,
      min: 1,
      evictionRunIntervalMillis: 5000,
      ...(opts ?? {}),
    };

    let createErrors = 0;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.pool = gp.createPool({
      async create() {
        try {
          self.pendingAcquires += 1;
          const res = await getWorker();

          if (res.init) {
            await res.init();
          }

          createErrors = 0; // Reset errors on success

          return res;
        } catch (e) {
          if (createErrors++ > args.max) { // If error count is bigger than pool size, we broke
            console.error(e);
            process.exit(1);
          }
          throw e;
        } finally {
          self.pendingAcquires -= 1;
        }
      },
      async destroy(x: T) {
        console.trace(`[${process.pid}] Destroying ${x.id}`);
        return x.destroy();
      },
      async validate(x: T) {
        return x.active;
      }
    }, args);

    ShutdownManager.onShutdown(`worker.pool.${this.constructor.name}`, () => this.shutdown());
  }

  async release(worker: T) {
    console.trace(`[${process.pid}] Releasing ${worker.id}`);
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

  async process(src: InputSource<X>) {
    const pending = new Set<Promise<any>>();

    while (await src.hasNext()) {
      const worker = (await this.pool.acquire())!;
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

  async shutdown() {
    while (this.pendingAcquires) {
      await new Promise(r => setTimeout(r, 10));
    }
    await this.pool.drain();
    await this.pool.clear();
  }
}
