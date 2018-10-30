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
        x.kill();
        return;
      },
      async validate(x: T) {
        return x.active;
      }
    }, args);

    Shutdown.onShutdown(ExecutionPool.name, () => this.shutdown());
  }

  release(execution: T) {
    if (execution.active) {
      if (execution.release) {
        execution.release();
      }
      try {
        this.pool.release(execution);
      } catch (e) {
        // Ignore if not owned
      }
    } else {
      try {
        this.pool.destroy(execution);
      } catch (e) {
        // Ignore if not owned
      }
    }
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
