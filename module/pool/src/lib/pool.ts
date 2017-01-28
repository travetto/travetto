import { createPool, Pool, PoolConfig, PoolFactory } from 'generic-pool';
import { Shutdown } from '@encore/lifecycle';

export * from 'generic-pool';
export class PoolManager<T, U> {

  private static POOL_OPTIONS = {
    max: 2,
    min: 1,
    idleTimeoutMillis: Number.MAX_VALUE,
  };

  private pools: Map<U, Pool<T>> = new Map();

  constructor(private name: string, private factory: (key: U) => PoolFactory<T>) {
    Shutdown.onShutdown(`pool-${name}`, () => this.shutdown());
  }

  async shutdown() {
    let promises = [];
    for (let key of this.pools.keys()) {
      let el = this.pools.get(key) as Pool<T>;
      if (!el) {
        continue;
      }
      promises.push(el.drain().then(() => {
        el.clear();
        this.pools.delete(key);
      }));
    }
    return Promise.all(promises);
  }

  async acquire(key: U, opts?: PoolConfig) {
    if (!this.pools.has(key)) {
      this.pools.set(key, createPool(
        this.factory(key),
        Object.assign({}, PoolManager.POOL_OPTIONS, opts || {})));
    }

    let pool = this.pools.get(key) as Pool<T>;
    let resource = await pool.acquire();
    let release = () => pool.release(resource);
    return { resource, release };
  }
}

