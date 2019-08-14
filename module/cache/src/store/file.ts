import * as os from 'os';
import * as fs from 'fs';
import * as util from 'util';

import { FsUtil } from '@travetto/boot';
import { SystemUtil, Shutdown, Util } from '@travetto/base';

import { CacheEntry, LocalCacheStore } from './types';

const fsStat = util.promisify(fs.stat);
const fsReaddir = util.promisify(fs.readdir);
const fsRead = util.promisify(fs.readFile);
const fsWrite = util.promisify(fs.writeFile);
const fsUpdateTime = util.promisify(fs.utimes);
const fsUnlink = util.promisify(fs.unlink);

export class FileCacheStore extends LocalCacheStore {

  folder = FsUtil.resolveUnix(os.tmpdir(), Util.uuid(6));

  constructor() {
    super();
    Shutdown.onShutdown(`FileCache.${this.folder}`, () => this.reset());
    fs.mkdirSync(this.folder);
  }

  reset() {
    FsUtil.unlinkRecursiveSync(this.folder, true);
  }

  getPath(key: string) {
    return FsUtil.resolveUnix(this.folder, key);
  }

  async has(key: string): Promise<boolean> {
    try {
      await fsStat(this.getPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    try {
      const pth = this.getPath(key);
      const value = await fsRead(pth, 'utf8');
      const entry = JSON.parse(value) as CacheEntry;

      if (entry.stream) {
        entry.data = fs.createReadStream(entry.data); // Convert to stream
      }

      return entry;
    } catch {
      return undefined;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<any> {
    this.cull();

    const pth = this.getPath(key);
    let value = entry.data;
    if (this.isStream(value)) {
      const streamed = `${pth}.stream`;
      entry.stream = true;
      entry.data = streamed;
      await SystemUtil.streamToFile(value as NodeJS.ReadableStream, streamed);
      value = fs.createReadStream(streamed);
    }
    await fsWrite(pth, JSON.stringify(entry), 'utf8');

    if (entry.maxAge) {
      await this.touch(pth);
    }

    return value;
  }

  async evict(key: string): Promise<boolean> {
    try {
      await fsUnlink(this.getPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async touch(key: string): Promise<boolean> {
    const pth = this.getPath(key);
    if (await this.has(key)) {
      // Convert to epoch seconds
      const sec = (Date.now() / 1000) + 1;
      await fsUpdateTime(pth, sec, sec);
      return true;
    }
    return false;
  }

  async getAllKeys() {
    return fsReaddir(this.folder);
  }

  async isExpired(key: string) {
    const pth = FsUtil.resolveUnix(this.folder, key);
    const stat = await fsStat(pth);
    if (stat.mtimeMs !== stat.birthtimeMs) { // If it has been touched at least once
      const contents = await fsRead(pth, 'utf8');
      try {
        const data = JSON.parse(contents);
        if (data.expiresAt < Date.now()) {
          return true;
        }
      } catch {
      }
    }
    return false;
  }
}