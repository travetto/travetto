import * as redis from 'redis';

import { CacheEntry } from '../src/types';
import { CacheStore } from '../src/store/core';
import { CacheStoreUtil } from '../src/store/util';

export class RedisCacheStore extends CacheStore {

  cl: redis.RedisClient;

  constructor(public config: redis.ClientOpts = {}) {
    super();
  }

  async postConstruct() {
    this.cl = new redis.RedisClient(this.config);
  }

  toPromise<V>(fn: (cb: redis.Callback<V>) => void): Promise<V> {
    return new Promise((res, rej) => fn((err: Error | undefined | null, v: V) => err ? rej(err) : res(v)));
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    const val: any = await this.toPromise(this.cl.get.bind(this.cl, key));
    if (val) {
      const ret = CacheStoreUtil.readAsSafeJSON(val);
      return { ...ret, expiresAt: ret.maxAge ? ret.maxAge + Date.now() : undefined };
    }
  }

  async has(key: string): Promise<boolean> {
    return !!(await this.toPromise(this.cl.exists.bind(this.cl, key)));
  }

  async set(key: string, entry: CacheEntry): Promise<any> {
    const cloned = CacheStoreUtil.storeAsSafeJSON(entry);

    await this.toPromise(this.cl.setnx.bind(this.cl, key, cloned));

    if (entry.maxAge) {
      await this.touch(key, entry.maxAge + Date.now());
    }

    return CacheStoreUtil.readAsSafeJSON(cloned);
  }

  async delete(key: string): Promise<boolean> {
    return !!(await this.toPromise(this.cl.del.bind(this.cl, key)));
  }

  async isExpired(key: string) {
    return !(await this.has(key));
  }

  async touch(key: string, expiresAt: number): Promise<boolean> {
    return !!(await this.toPromise(this.cl.pexpireat.bind(this.cl, key, expiresAt)));
  }

  async clear() {
    await this.toPromise(this.cl.flushall.bind(this.cl));
  }

  async keys() {
    return await this.toPromise(this.cl.keys.bind(this.cl, '*'));
  }
}