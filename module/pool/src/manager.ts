import { createPool, Pool, Options, Factory } from 'generic-pool';

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

  constructor(private name: string, private factory: () => Factory<T>) { }

  async shutdown() {
    await this.pool.drain();
    this.pool.clear();
  }

  async acquire(opts?: Options) {
    if (!this.pool) {
      this.pool = createPool(
        this.factory(),
        { ...PoolManager.POOL_OPTIONS, ...(opts || {}) });
    }
    const resource = await this.pool.acquire();
    const release = async () => {
      if (resource.evict) {
        await this.pool.destroy(resource);
      } else {
        await this.pool.release(resource);
      }
    };
    return { resource, release };
  }
}