import * as redis from 'redis';

import { CacheStore, CacheEntry } from '../src/store/types';

export class RedisCacheStore extends CacheStore {

  cl: redis.RedisClient;

  constructor(public config: redis.ClientOpts = {}) {
    super();
  }

  async postConstruct() {
    this.cl = new redis.RedisClient(this.config);
  }

  toPromise<V>(fn: (cb: redis.Callback<V>) => void): Promise<V> {
    return new Promise((res, rej) => fn((err: Error | undefined, v: V) => err ? rej(err) : res(v)));
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    const val: any = await this.toPromise(this.cl.get.bind(this.cl, key));
    return val && this.postLoad(JSON.parse(val));
  }

  async has(key: string): Promise<boolean> {
    return !!(await this.toPromise(this.cl.exists.bind(this.cl, key)));
  }

  async set(key: string, entry: CacheEntry): Promise<any> {
    entry = await this.prePersist(entry);

    await this.toPromise(this.cl.setnx.bind(this.cl, key, JSON.stringify(entry)));

    if (entry.maxAge) {
      await this.touch(key, entry.maxAge + Date.now());
    }

    return this.postLoad(entry).data;
  }

  async evict(key: string): Promise<boolean> {
    return !!(await this.toPromise(this.cl.del.bind(this.cl, key)));
  }

  async touch(key: string, expiresAt: number): Promise<boolean> {
    return !!(await this.toPromise(this.cl.pexpireat.bind(this.cl, key, expiresAt)));
  }

  async reset() {
    await this.toPromise(this.cl.flushall.bind(this.cl));
  }
}