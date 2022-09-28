import {
  Stats, mkdirSync, constants, accessSync, readdirSync,
  readFileSync, writeFileSync, unlinkSync, statSync, rmdirSync
} from 'fs';
import * as path from 'path';

import { EnvUtil } from './env';
import { FsUtil } from './fs';
import { PathUtil } from './path';

/**
 * Standard file cache, with output file name normalization and truncation
 */
export class FileCache {

  static isOlder(cacheStat: Stats, fullStat: Stats): boolean {
    return cacheStat.ctimeMs < fullStat.ctimeMs || cacheStat.mtimeMs < fullStat.mtimeMs;
  }

  #cache = new Map<string, Stats>();

  /**
   * Directory to cache into
   */
  readonly cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = PathUtil.resolveUnix(cacheDir);
  }

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
        if (entryPath.endsWith('.ts')) {
          continue;
        }
        const full = this.fromEntryName(entryPath);
        try {
          this.removeExpiredEntry(full);
        } catch (err) {
          // Only care if it's source, otherwise might be dynamically cached data without backing file
          if (full.endsWith('.ts')) {
            // Cannot remove file, source is missing
            console.warn('Cannot read', { error: err });
          }
        }
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
    if (!EnvUtil.isReadonly()) {
      mkdirSync(this.cacheDir, { recursive: true });

      try {
        // Ensure we have access before trying to delete
        accessSync(this.cacheDir, constants.W_OK);
      } catch {
        throw new Error(`Unable to write to cache directory: ${this.cacheDir}`);
      }
      if (purgeExpired) {
        this.#purgeExpired();
      }
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
    if (entryPath.endsWith('.js')) {
      writeFileSync(entryPath.replace(/[.]js$/, '.ts'), '', 'utf8'); // Placeholder
    }
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
   * Delete expired entries
   * @param full The local location
   * @param force Should deletion be force
   */
  removeExpiredEntry(local: string, force = false): void {
    if (this.hasEntry(local)) {
      try {
        if (force || FileCache.isOlder(this.statEntry(local), statSync(local))) {
          const localName = this.toEntryName(local);
          unlinkSync(localName);
          if (localName.endsWith('.js')) {
            unlinkSync(localName.replace(/[.]js$/, '.ts'));
          }
        }
      } catch (err) {
        if (!(err instanceof Error) || !err.message.includes('ENOENT')) {
          throw err;
        }
      }
      this.removeEntry(local);
    }
  }

  /**
   * Delete entry
   * @param local The location to delete
   */
  removeEntry(local: string): void {
    this.#cache.delete(local);
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
   * Map entry file name to the original source
   * @param entry The entry path
   */
  fromEntryName(entry: string): string {
    return PathUtil.resolveUnix(PathUtil.resolveFrameworkPath(PathUtil.toUnix(entry)
      .replace(this.cacheDir, '')
      .replace(/^\//, '')
      .replace(/\/\/+/g, '/')
      .replace(/[.]js$/, '.ts')
    ));
  }

  /**
   * Map the original file name to the cache file space
   * @param local Local path
   */
  toEntryName(local: string): string {
    local = PathUtil.toUnix(local).replace(PathUtil.cwd, '');
    return PathUtil.joinUnix(this.cacheDir, PathUtil.normalizeFrameworkPath(local)
      .replace(/.*@travetto/, 'node_modules/@travetto')
      .replace(/^\//, '')
      .replace(/[.]ts$/, '.js')
    );
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

export const AppCache = new FileCache(EnvUtil.get('TRV_CACHE', '.trv_cache'));