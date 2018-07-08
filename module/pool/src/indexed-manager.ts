import { Options } from 'generic-pool';
import { PoolManager, BaseResource } from './manager';

export class IndexedPoolManager<T extends BaseResource, U> {

  private pools: Map<U, PoolManager<T>> = new Map();

  constructor(private factory: (index: U) => PoolManager<T>) { }

  async acquire(index: U, opts?: Options) {
    if (!this.pools.has(index)) {
      this.pools.set(index, this.factory(index));
    }

    const pool = this.pools.get(index) as PoolManager<T>;
    return await pool.acquire(opts);
  }
}