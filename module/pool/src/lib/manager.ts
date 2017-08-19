import { createPool, Pool, Options, PoolFactory } from 'generic-pool';
import { Shutdown } from '@encore/lifecycle';

export interface BaseResource {
  evict?: boolean;
}

export class PoolManager<T extends BaseResource> {

  private static POOL_OPTIONS = {
    max: 2,
    min: 1,
    idleTimeoutMillis: Number.MAX_VALUE,
  };

  pool: Pool<T>;

  constructor(private name: string, private factory: () => PoolFactory<T>) {
    Shutdown.onShutdown(`pool-${name}`, () => this.shutdown());
  }

  async shutdown() {
    await this.pool.drain();
    this.pool.clear();
  }

  async acquire(opts?: Options) {
    if (!this.pool) {
      this.pool = createPool(
        this.factory(),
        Object.assign({}, PoolManager.POOL_OPTIONS, opts || {}));
    }
    let resource = await this.pool.acquire();
    let release = async () => {
      if (resource.evict) {
        await this.pool.destroy(resource);
      } else {
        await this.pool.release(resource);
      }
    };
    return { resource, release };
  }
}