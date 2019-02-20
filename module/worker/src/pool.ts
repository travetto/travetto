import * as os from 'os';
import { createPool, Pool, Options } from 'generic-pool';

import { Shutdown } from '@travetto/base';

import { WorkerInputSource, WorkerPoolElement } from './types';

export class WorkerPool<T extends WorkerPoolElement> {

  private pool: Pool<T>;

  constructor(create: () => Promise<T>, opts?: Options) {
    const args = {
      max: Math.min(os.cpus().length - 1, 4),
      min: 1,
      evictionRunIntervalMillis: 5000,
      ...(opts || {}),
    };

    this.pool = createPool({
      create: async () => {
        try {
          return await create();
        } catch (e) {
          process.exit(1); // TODO: evaluate strategy
          throw e;
        }
      },
      async destroy(x: T): Promise<undefined> {
        console.trace(`[${process.pid}] Destroying ${(x as any)['pid']}`);
        x.kill();
        return;
      },
      async validate(x: T) {
        return x.active;
      }
    }, args);

    Shutdown.onShutdown(WorkerPool.name, () => this.shutdown());
  }

  async release(Worker: T) {
    console.trace(`[${process.pid}] Releasing ${(Worker as any)['pid']}`);
    try {
      if (Worker.active) {
        if (Worker.release) {
          try {
            await Worker.release();
          } catch { }
        }
        await this.pool.release(Worker);
      } else {
        await this.pool.destroy(Worker);
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
