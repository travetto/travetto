import * as os from 'os';
import { createPool, Pool, Options } from 'generic-pool';

import { Shutdown } from '@travetto/base';

import { WorkerInputSource, WorkerPoolElement } from './types';

export class WorkerPool<T extends WorkerPoolElement> {

  static DEFAULT_SIZE = Math.min(os.cpus().length - 1, 4);

  private pool: Pool<T>;

  constructor(create: () => Promise<T>, opts?: Options) {
    const args = {
      max: WorkerPool.DEFAULT_SIZE,
      min: 1,
      evictionRunIntervalMillis: 5000,
      ...(opts || {}),
    };

    this.pool = createPool({
      create: async () => {
        try {
          return await create();
        } catch (e) {
          // process.exit(1); // TODO: evaluate strategy
          throw e;
        }
      },
      async destroy(x: T) {
        console.trace(`[${process.pid}] Destroying ${x.id}`);
        await x.kill();
        return;
      },
      async validate(x: T) {
        return x.active;
      }
    }, args);

    Shutdown.onShutdown(`worker.pool.${WorkerPool.name}`, () => this.shutdown());
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

  async process<X>(src: WorkerInputSource<X>, exec: (inp: X, exe: T) => Promise<any>) {
    const pending = new Set();

    while (src.hasNext()) {
      const exe = (await this.pool.acquire())!;
      const next = await src.next();
      const release = this.release.bind(this, exe);

      const completion = exec(next, exe)
        .then(release, release);

      completion.then(x => {
        pending.delete(completion);
      });

      pending.add(completion);
    }

    await Promise.all(Array.from(pending));
  }

  async shutdown() {
    await this.pool.drain();
    await this.pool.clear();
  }
}
