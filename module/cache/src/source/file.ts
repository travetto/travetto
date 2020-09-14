import * as os from 'os';
import { promises as fs } from 'fs';

import { FsUtil } from '@travetto/boot';
import { ShutdownManager, Util } from '@travetto/base';

import { CullableCacheSource } from './cullable';
import { CacheEntry } from '../types';
import { CacheSourceUtil } from './util';

/**
 * A cache source backed by the file system
 */
export class FileCacheSource<T extends CacheEntry = CacheEntry> extends CullableCacheSource<T> {

  folder = FsUtil.resolveUnix(os.tmpdir(), Util.uuid(6));

  constructor() {
    super();
    ShutdownManager.onShutdown(`FileCache.${this.folder}`, () => this.clear());
    FsUtil.mkdirpSync(this.folder);
  }

  clear() {
    FsUtil.unlinkRecursiveSync(this.folder, true);
  }

  getPath(key: string) {
    return FsUtil.resolveUnix(this.folder, key);
  }

  async has(key: string): Promise<boolean> {
    try {
      await fs.stat(this.getPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<T | undefined> {
    try {
      const pth = this.getPath(key);
      const value = await fs.readFile(pth, 'utf8');
      return CacheSourceUtil.readAsSafeJSON(value) as T;
    } catch {
      return;
    }
  }

  async set(key: string, entry: T): Promise<any> {
    this.cull();

    if (entry.maxAge) {
      entry.expiresAt = entry.maxAge + Date.now();
    }

    const pth = this.getPath(key);

    const cloned = CacheSourceUtil.storeAsSafeJSON(entry);

    await fs.writeFile(pth, cloned, 'utf8');

    if (entry.expiresAt) {
      await this.touch(pth, entry.expiresAt);
    }

    return CacheSourceUtil.readAsSafeJSON(cloned);
  }

  async delete(key: string): Promise<boolean> {
    try {
      await fs.unlink(this.getPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async touch(key: string, expiresAt: number): Promise<boolean> {
    const pth = this.getPath(key);
    if (await this.has(key)) {
      // Convert to epoch seconds
      const sec = (Date.now() / 1000) + 1;
      await fs.utimes(pth, sec, sec);
      return true;
    }
    return false;
  }

  async keys() {
    return fs.readdir(this.folder);
  }

  async isExpired(key: string) {
    const pth = FsUtil.resolveUnix(this.folder, key);
    const stat = await fs.stat(pth);
    if (stat.mtimeMs !== stat.birthtimeMs) { // If it has been touched at least once
      const entry = await this.get(key);
      try {
        if (entry && entry.expiresAt && entry.expiresAt < Date.now()) {
          return true;
        }
      } catch {
      }
    }
    return false;
  }
}