import * as os from 'os';

import { Shutdown } from '@travetto/base';
import { Factory, createPool, Pool, Options } from 'generic-pool';

import { DataSource, ConcurrentOp } from './types';

export class ConcurrentPool<T extends ConcurrentOp> {

  private pool: Pool<T>;

  constructor(private create: () => Promise<T>, opts?: Options) {
    this.pool = createPool({
      create,
      async destroy(x: T): Promise<undefined> {
        x.kill();
        return;
      },
      async validate(x: T) {
        return x.active;
      }
    }, {
        max: os.cpus().length - 1,
        min: 1,
        ...(opts || {})
      });

    Shutdown.onShutdown(ConcurrentPool.name, () => this.shutdown());
  }

  release(execution: T) {
    if (execution.active) {
      if (execution.release) {
        execution.release();
      }
      this.pool.release(execution);
    } else {
      this.pool.destroy(execution);
    }
  }

  async process<X>(src: DataSource<X>, exec: (inp: X, exe: T) => Promise<any>) {
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
    this.pool.clear();
  }
}
