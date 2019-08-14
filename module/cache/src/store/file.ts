import * as os from 'os';
import * as fs from 'fs';
import * as util from 'util';

import { FsUtil } from '@travetto/boot';
import { SystemUtil, Shutdown } from '@travetto/base';

import { CacheStore, CacheEntry } from './type';

const fsStat = util.promisify(fs.stat);
const fsRead = util.promisify(fs.readFile);
const fsWrite = util.promisify(fs.writeFile);
const fsOpen = util.promisify(fs.open);
const fsUpdateTime = util.promisify(fs.futimes);
const fsUnlink = util.promisify(fs.unlink);

export class FileCacheStore extends CacheStore {

  folder = os.tmpdir();

  constructor() {
    super();
    Shutdown.onShutdown(`FileCache.${this.folder}`, () => this.reset());
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
      const stat = await fsStat(pth);
      const entry = JSON.parse(value) as CacheEntry;

      if (entry.stream) {
        entry.data = fs.createReadStream(entry.data.split('READABLE: ')[1]); // Convert to stream
      }
      if (entry.maxAge) {
        entry.expiresAt = stat.mtimeMs + entry.maxAge; // Tie expiration to mtime
      }
      return entry;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: CacheEntry): Promise<void> {
    const pth = this.getPath(key);
    if ('pipe' in value.data) /* Stream */ {
      const streamed = `${pth}.stream`;
      await SystemUtil.streamToFile(value.data as NodeJS.ReadableStream, streamed);
      value.stream = true;
    }
    await fsWrite(pth, JSON.stringify(value));
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
      const fd = await fsOpen(pth, 'r');
      await fsUpdateTime(fd, Date.now(), Date.now());
      return true;
    }
    return false;
  }
}