import * as fs from 'fs';
import * as util from 'util';
import * as os from 'os';
import * as path from 'path';

import { FsUtil } from '@travetto/boot';
import { Util } from '@travetto/base';

const read = util.promisify(fs.readFile);
const write = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
const stat = util.promisify(fs.stat);

import { CacheStore, CacheEntry } from '../types';

export class FileCacheStore<V> implements CacheStore<V> {

  private stats = new Map<string, fs.Stats>();
  private dir: string;

  constructor(public name: string) {
    this.dir = FsUtil.resolveUnix(os.tmpdir(), `cache_${Util.uuid(10)}_${name.replace(/[^A-Za-z0-9_]/g, '_')}`);
    this.primeCache();
  }

  primeCache() {
    try {
      fs.mkdirSync(this.dir);
    } catch (e) {
      console.log(e);
    }

    for (const el of fs.readdirSync(this.dir)) {
      const k = Buffer.from(path.basename(el), 'base64').toString();
      this.stats.set(k, fs.statSync(FsUtil.resolveUnix(this.dir, el)));
    }
  }

  getPath(key: string) {
    key = Buffer.from(key).toString('base64');
    return FsUtil.resolveUnix(this.dir, key);
  }

  get size() {
    return this.stats.size;
  }

  async get(key: string) {
    const text = await read(this.getPath(key), 'utf8');
    const entry = JSON.parse(text) as CacheEntry<V>;
    return entry;
  }

  async has(key: string) {
    try {
      this.stats.has(this.getPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string) {
    await unlink(this.getPath(key));
    this.stats.delete(key);
    return true;
  }

  async set(key: string, v: CacheEntry<V>) {
    const f = this.getPath(key);
    await write(f, JSON.stringify(v));
    const stats = await stat(f);
    this.stats.set(key, stats);
  }

  async clear() {
    await FsUtil.unlinkRecursive(this.dir);
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