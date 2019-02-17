import * as os from 'os';
import { createPool, Pool, Options } from 'generic-pool';

import { Shutdown } from '@travetto/base';

import { ExecutionSource, ConcurrentExecution } from './types';

export class ExecutionPool<T extends ConcurrentExecution> {

  private pool: Pool<T>;

  constructor(create: () => Promise<T>, opts?: Options) {
    const args = {
      max: os.cpus().length - 1,
      min: 1,
      evictionRunIntervalMillis: 5000,
      ...(opts || {}),
    };

    this.pool = createPool({
      create,
      async destroy(x: T): Promise<undefined> {
        console.trace(`[${process.pid}] Destroying ${(x as any)['pid']}`);
        x.kill();
        return;
      },
      async validate(x: T) {
        return x.active;
      }
    }, args);

    Shutdown.onShutdown(ExecutionPool.name, () => this.shutdown());
  }

  async release(execution: T) {
    console.trace(`[${process.pid}] Releasing ${(execution as any)['pid']}`);
    try {
      if (execution.active) {
        if (execution.release) {
          try {
            await execution.release();
          } catch { }
        }
        await this.pool.release(execution);
      } else {
        await this.pool.destroy(execution);
      }
    } catch { }
  }

  async process<X>(src: ExecutionSource<X>, exec: (inp: X, exe: T) => Promise<any>) {
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
