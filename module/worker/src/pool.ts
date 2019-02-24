import * as os from 'os';
import * as gp from 'generic-pool';

import { Shutdown } from '@travetto/base';

import { InputSource } from './input/types';

export interface Worker<X> {
  active: boolean;
  id: any;
  init?(): any;
  execute(input: X): Promise<any>;
  destroy(): any;
  release?(): any;
}

export class WorkPool<X, T extends Worker<X>> {

  static DEFAULT_SIZE = Math.min(os.cpus().length - 1, 4);

  private pool: gp.Pool<T>;
  private errors: Error[] = [];

  constructor(getWorker: () => Promise<T> | T, opts?: gp.Options) {
    const args = {
      max: WorkPool.DEFAULT_SIZE,
      min: 1,
      evictionRunIntervalMillis: 5000,
      ...(opts || {}),
    };

    this.pool = gp.createPool({
      create: async () => {
        const res = await getWorker();

        if (res.init) {
          await res.init();
        }
        return res;
      },
      async destroy(x: T) {
        console.trace(`[${process.pid}] Destroying ${x.id}`);
        return x.destroy();
      },
      async validate(x: T) {
        return x.active;
      }
    }, args);

    Shutdown.onShutdown(`worker.pool.${this.constructor.name}`, () => this.shutdown());
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
    const pending = new Set();

    while (src.hasNext()) {
      const worker = (await this.pool.acquire())!;
      const nextInput = await src.next();
      const release = this.release.bind(this, worker);

      const completion = worker.execute(nextInput)
        .catch(err => this.errors.push(err)) // Catch error
        .then(release, release);

      completion.finally(() => pending.delete(completion));

      pending.add(completion);
    }

    await Promise.all(Array.from(pending));

    if (this.errors.length) {
      throw this.errors[0];
    }
  }

  async shutdown() {
    await this.pool.drain();
    await this.pool.clear();
  }
}
