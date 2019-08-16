import * as redis from 'redis';

import { SystemUtil } from '@travetto/base';

import { CacheStore, CacheEntry } from '../src/store/types';

export class RedisCacheStore extends CacheStore {

  client: redis.RedisClient;

  constructor(public config: redis.ClientOpts = {}) {
    super();
  }

  async postConstruct() {
    this.client = new redis.RedisClient(this.config)
  }

  toPromise<V>(fn: (cb: redis.Callback<V>) => void): Promise<V> {
    return new Promise((res, rej) => fn((err, v) => err ? rej(err) : res(v)));
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    let val: any = await this.toPromise(this.client.get.bind(this.client, key));
    if (!(val === null || val === undefined)) {
      val = JSON.parse(val) as CacheEntry;
      if (val.stream) {
        val.data = SystemUtil.toReadable(val.data);
      }
    }
    return val;
  }

  async has(key: string): Promise<boolean> {
    return !!(await this.toPromise(this.client.exists.bind(this.client, key)));
  }

  async set(key: string, entry: CacheEntry): Promise<any> {
    let data = entry.data;
    let ret = data;

    if (this.isStream(data)) {
      data = (await SystemUtil.toBuffer(data)).toString('base64');
      ret = SystemUtil.toReadable(Buffer.from(data, 'base64'));
      entry.stream = true;
    }

    const storeValue = JSON.stringify({ ...entry, data });

    await this.toPromise(this.client.setnx.bind(this.client, key, storeValue));

    if (entry.maxAge) {
      await this.touch(key, entry.maxAge + Date.now());
    }

    return ret;
  }

  async evict(key: string): Promise<boolean> {
    return !!(await this.toPromise(this.client.del.bind(this.client, key)));
  }

  async touch(key: string, expiresAt: number): Promise<boolean> {
    return !!(await this.toPromise(this.client.pexpireat.bind(this.client, key, expiresAt)));
  }

  async reset() {
    await this.toPromise(this.client.flushall.bind(this.client));
  }
}