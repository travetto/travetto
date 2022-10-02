import {
  Stats, mkdirSync, constants, accessSync, readdirSync,
  readFileSync, writeFileSync, unlinkSync, statSync, rmdirSync
} from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

import { EnvUtil } from './env';
import { FsUtil } from './fs';
import { PathUtil } from './path';

/**
 * Standard file cache, with output file name normalization and truncation
 */
export class FileCache {

  #cache = new Map<string, Stats>();

  /**
   * Directory to cache into
   */
  readonly cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = PathUtil.resolveUnix(cacheDir);
  }

  /**
   * Map entry file name to the original source
   * @param entry The entry path
   */
  protected fromEntryName(entry: string): string {
    return PathUtil.toUnix(entry)
      .replace(this.cacheDir, '')
      .replace(/^\//, '')
      .replace(/\/\/+/g, '/');
  }

  /**
   * Map the original file name to the cache file space
   * @param local Local path
   */
  protected toEntryName(local: string): string {
    local = PathUtil.toUnix(local).replace(PathUtil.cwd, '');
    return PathUtil.joinUnix(this.cacheDir, local.replace(/^\//, ''));
  }

  get shortCacheDir(): string {
    return this.cacheDir.replace(`${PathUtil.cwd}/`, '');
  }

  /**
   * Initialize the cache behavior
   */
  init(): void {
    mkdirSync(this.cacheDir, { recursive: true });

    try {
      // Ensure we have access before trying to delete
      accessSync(this.cacheDir, constants.W_OK);
    } catch {
      throw new Error(`Unable to write to cache directory: ${this.cacheDir}`);
    }
  }

  /**
   * Write contents to disk
   * @param local Local location
   * @param contents Contents to write
   */
  writeEntry(local: string, contents: string): void {
    const entryPath = this.toEntryName(local);
    mkdirSync(path.dirname(entryPath), { recursive: true });
    writeFileSync(entryPath, contents, 'utf8');
    this.statEntry(local);
  }

  /**
   * Read entry from disk
   * @param local Read the entry given the local name
   */
  readEntry(local: string): string {
    return readFileSync(this.toEntryName(local), 'utf8');
  }

  /**
   * Read optional entry from disk, undefined if missing
   * @param local Read the entry given the local name
   */
  readOptionalEntry(local: string): string | undefined {
    return this.hasEntry(local) ? this.readEntry(local) : undefined;
  }

  /**
   * Delete entry
   * @param local The location to delete
   */
  removeEntry(local: string, unlink = false): void {
    this.#cache.delete(local);
    if (unlink) {
      unlinkSync(this.toEntryName(local));
    }
  }

  /**
   * Checks to see if a file has been loaded or if it's available on disk
   * @param local The location to verify
   */
  hasEntry(local: string): boolean {
    return this.#cache.has(local) || !!FsUtil.existsSync(this.toEntryName(local));
  }

  /**
   * Retrieve fs.Stats of the associated path
   * @param local The location to stat
   */
  statEntry(local: string): Stats {
    if (!this.#cache.has(local)) {
      const stat = statSync(this.toEntryName(local));
      this.#cache.set(local, stat);
    }
    return this.#cache.get(local)!;
  }

  /**
   * Clear cache
   * @param quiet Should the clear produce output
   */
  clear(quiet = false): void {
    if (this.cacheDir) {
      try {
        FsUtil.unlinkRecursiveSync(this.cacheDir);
        if (!quiet) {
          console.debug('Deleted', { cacheDir: this.cacheDir });
        }
        this.#cache.clear(); // Clear it out
      } catch {
        console.error('Failed in deleting');
      }
    }
  }

  /**
   * Ensure a cache entry is prepared for writing
   * @param local
   */
  openEntryHandle(local: string, flags?: string | number, mode?: number): Promise<fsp.FileHandle> {
    const target = this.toEntryName(local);
    mkdirSync(path.dirname(target), { recursive: true });
    return fsp.open(target, flags, mode);
  }

  /**
   * Get or set a value (from the create function) if not in the cache
   * @param local The local location
   * @param create The method to execute if the entry is not found
   * @param force Should create be executed always
   */
  getOrSet(local: string, create: () => string, force = false): string {
    const name = PathUtil.toUnix(local);
    let content: string;
    if (force || !this.hasEntry(name)) {
      this.writeEntry(name, content = create());
    } else {
      content = this.readEntry(name);
    }
    return content;
  }
}

export class ExpiryFileCache extends FileCache {
  /**
   * Purge all expired data
   */
  #purgeExpired(dir = this.cacheDir): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const entryPath = PathUtil.joinUnix(dir, entry);
      const stat = statSync(entryPath);
      if (stat.isDirectory() || stat.isSymbolicLink()) {
        this.#purgeExpired(entryPath);
      } else {
        const full = this.fromEntryName(entryPath);
        try {
          this.removeExpiredEntry(full);
        } catch (err) { }
      }
    }
    if (entries.length === 0 && dir !== this.cacheDir) {
      try {
        rmdirSync(dir);
      } catch {
        // Nothing
      }
    }
  }

  /**
   * Initialize the cache behavior
   */
  init(purgeExpired = false): void {
    super.init();
    if (purgeExpired) {
      this.#purgeExpired();
    }
  }

  /**
   * Delete expired entries
   * @param full The local location
   * @param force Should deletion be force
   */
  removeExpiredEntry(local: string, force = false): void {
    if (this.hasEntry(local)) {
      try {
        if (force || FsUtil.isOlder(this.statEntry(local), statSync(local))) {
          const localName = this.toEntryName(local);
          unlinkSync(localName);
        }
      } catch (err) {
        if (!(err instanceof Error) || !err.message.includes('ENOENT')) {
          throw err;
        }
      }
      this.removeEntry(local);
    }
  }
}

export const AppCache = new FileCache(EnvUtil.get('TRV_APP_CACHE', '.app_cache'));
