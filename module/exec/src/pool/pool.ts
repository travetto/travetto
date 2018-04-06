import * as os from 'os';

import { Shutdown } from '@travetto/base';
import { Factory, createPool, Pool, Options } from '@travetto/pool';

import { Execution } from '../execution';
import { ExecutionEvent } from '../types';

import { DataSource } from './types';

export class ExecutionPool<T extends Execution<U>, U extends ExecutionEvent = ExecutionEvent> {

  private pool: Pool<T>;

  constructor(private create: () => Promise<T>, opts?: Options) {
    this.pool = createPool({
      create,
      async destroy(x: T): Promise<undefined> {
        x.kill();
        return;
      },
      async validate(x: T) {
        return !!x._proc;
      }
    }, {
        max: os.cpus().length - 1,
        min: 1,
        ...(opts || {})
      });

    Shutdown.onShutdown(ExecutionPool.name, () => this.shutdown());
  }

  async getNextExecution() {
    return await this.pool.acquire();
  }

  returnExecution(execution: T) {
    execution.clean();
    if (!!execution._proc) {
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
      const release = this.returnExecution.bind(this, exe);

      console.log('Processing', next, exe.pid);

      const completion = exec(next, exe)
        .then(release, release);

      completion.then(x => {
        pending.delete(completion);
      });

      pending.add(completion);
    }

    await Promise.all(Array.from(pending));
  }

  shutdown() {
    this.pool.drain();
  }
}
