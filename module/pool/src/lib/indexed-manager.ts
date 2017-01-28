import { PoolConfig } from './pool';
import { PoolManager } from './manager';

export class IndexedPoolManager<T, U> {

  private pools: Map<U, PoolManager<T>> = new Map();

  constructor(private factory: (index: U) => PoolManager<T>) { }

  async acquire(index: U, opts?: PoolConfig) {
    if (!this.pools.has(index)) {
      this.pools.set(index, this.factory(index));
    }

    let pool = this.pools.get(index) as PoolManager<T>;
    return await pool.acquire(opts);
  }
}