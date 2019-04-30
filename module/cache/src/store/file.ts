import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';

import { AppCache, FsUtil } from '@travetto/boot';
import { AppError } from '@travetto/base';

import { CacheStore, CacheEntry, CacheConfig } from '../types';

const read = util.promisify(fs.readFile);
const write = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
const stat = util.promisify(fs.stat);
const readdir = util.promisify(fs.readdir);
const mkdir = util.promisify(fs.mkdir);

export class FileCacheStore<V> implements CacheStore<V> {

  private stats = new Map<string, fs.Stats>();
  private pullThrough = new Map<string, CacheEntry<V>>();
  private dir: string;

  constructor(public config: CacheConfig<V>) {
    this.dir = FsUtil.resolveUnix(AppCache.cacheDir, `${config.name!.replace(/[^A-Za-z0-9_]/g, '_')}`);
  }

  async init() {
    try {
      const stats = await stat(this.dir);
      if (!stats.isDirectory()) {
        throw new AppError('Cache path is not a directory');
      }
      for (const el of await readdir(this.dir)) {
        const k = Buffer.from(path.basename(el), 'base64').toString();
        this.stats.set(k, await stat(FsUtil.resolveUnix(this.dir, el)));
      }
    } catch (e) {
      await mkdir(this.dir);
    }
  }

  async destroy() {
    await FsUtil.unlinkRecursive(this.dir);
  }

  getPath(key: string) {
    key = Buffer.from(key).toString('base64');
    return FsUtil.resolveUnix(this.dir, key);
  }

  get size() {
    return this.stats.size;
  }

  async get(key: string) {
    if (!this.pullThrough.has(key)) {
      const text = await read(this.getPath(key), 'utf8');
      const entry = JSON.parse(text) as CacheEntry<V>;
      return entry;
    } else {
      return this.pullThrough.get(key)!;
    }
  }

  async has(key: string) {
    return this.stats.has(key);
  }

  async delete(key: string) {
    await unlink(this.getPath(key));
    this.pullThrough.delete(key);
    this.stats.delete(key);
    return true;
  }

  async set(key: string, v: CacheEntry<V>) {
    const f = this.getPath(key);
    const text = JSON.stringify(v);
    this.pullThrough.set(key, JSON.parse(text));
    await write(f, text);
    const stats = await stat(f);
    this.stats.set(key, stats);
  }

  async clear() {
    this.pullThrough.clear();
    this.stats.clear();
  }

  async trim(size: number) {
    const keys = [...this.stats.entries()]
      .sort((a, b) => b[1].mtimeMs - a[1].mtimeMs)
      .slice(size)
      .map(x => x[0]);

    await Promise.all(keys.map(k => this.delete(k)));
  }

  async forEach(fn: (v: CacheEntry<V>, k: string) => void, self?: any) {
    for (const k of await this.stats.keys()) {
      const v = await this.get(k);
      fn.call(self, v, k);
    }
  }
}