// @file-if redis
import * as redis from 'redis';

import { CacheEntry } from '../types';
import { CacheSource } from '../source/core';
import { CacheSourceUtil } from '../source/util';

/**
 * A cache source backed by redis
 */
export class RedisCacheSource extends CacheSource {

  cl: redis.RedisClient;

  constructor(public config: redis.ClientOpts = {}) {
    super();
  }

  async postConstruct() {
    this.cl = new redis.RedisClient(this.config);
  }

  toPromise<V>(fn: (cb: redis.Callback<V>) => void): Promise<V> {
    return new Promise((res, rej) => fn((err, v) => err ? rej(err) : res(v)));
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    const val: any = await this.toPromise(this.cl.get.bind(this.cl, key));
    if (val) {
      const ret = CacheSourceUtil.readAsSafeJSON(val);
      return { ...ret, expiresAt: ret.maxAge ? ret.maxAge + Date.now() : undefined };
    }
  }

  async has(key: string): Promise<boolean> {
    return !!(await this.toPromise(this.cl.exists.bind(this.cl, key)));
  }

  async set(key: string, entry: CacheEntry): Promise<any> {
    const cloned = CacheSourceUtil.storeAsSafeJSON(entry);

    await this.toPromise(this.cl.setnx.bind(this.cl, key, cloned));

    if (entry.maxAge) {
      await this.touch(key, entry.maxAge + Date.now());
    }

    return CacheSourceUtil.readAsSafeJSON(cloned);
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