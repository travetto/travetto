import * as fs from 'fs';
import * as util from 'util';

import { FsUtil } from './fs';

const fsReaddir = util.promisify(fs.readdir);
const fsLstat = util.promisify(fs.lstat);
const fsRealpath = util.promisify(fs.realpath);

export interface ScanEntry {
  /**
   * Full file path
   */
  file: string;
  /**
   * File path as a relative path, like a module
   */
  module: string;
  /**
   * Stats information
   */
  stats: fs.Stats;
  /**
   * List of child entries
   */
  children?: ScanEntry[];
}

/**
 * Handler for searching through files
 */
export interface ScanHandler {
  /**
   * File test to see if valid
   * @param relative The relative file
   * @param entry The full entry
   */
  testFile?(relative: string, entry?: ScanEntry): boolean;
  /**
   * Dir test to see if valid
   * @param relative The relative dir
   * @param entry The full entry
   */
  testDir?(relative: string, entry?: ScanEntry): boolean;

  /**
   * When encountering a path, allow for translation of final location
   * @param fullPath The full path
   */
  resolvePath?(fullPath: string): string;
}

/**
 * File system scanning utilities
 */
export class ScanFs {

  /**
   * Detect if entry is a directory
   * @param x The entry to check
   */
  static isDir(x: ScanEntry) {
    return x.stats.isDirectory() || x.stats.isSymbolicLink();
  }

  /**
   * Detect if entry is not a directory
   * @param x The entry to check
   */
  static isNotDir(x: ScanEntry) {
    return !this.isDir(x);
  }

  /**
   * Scan a given directory, with the provided handler and base directory.
   * Performs a breadth first search, and will deference symlinks to prevent
   * infinite exploration.
   *
   * @param handler Handler to search with
   * @param base The starting point
   */
  static async scanDir(handler: ScanHandler, base: string) {
    const visited = new Set<string>();
    const out: ScanEntry[] = [];
    const dirs: ScanEntry[] = [
      { file: base, children: [] as ScanEntry[] } as ScanEntry
    ];

    while (dirs.length) {
      const dir = dirs.shift()!;
      for (const file of (await fsReaddir(dir.file))) {
        if (file.startsWith('.')) {
          continue;
        }

        let full = FsUtil.resolveUnix(dir.file, file);
        if (handler.resolvePath) {
          full = handler.resolvePath(full);
        }
        const stats = await fsLstat(full);
        const subEntry = { stats, file: full, module: full.replace(`${base}/`, '') };

        if (this.isDir(subEntry)) {
          if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
            if (subEntry.stats.isSymbolicLink()) {
              const p = await fsRealpath(full);
              if (!visited.has(p)) {
                visited.add(p);
              } else {
                continue;
              }
            }
            out.push(subEntry);
            dirs.push(subEntry);
          }
        } else if (!handler.testFile || handler.testFile(subEntry.module, subEntry)) {
          (dir.children = dir.children ?? []).push(subEntry);
          out.push(subEntry);
        }
      }
    }
    return out;
  }

  /**
   * Scan folders multiple times, once per handler, and union the results
   * @param handlers Handlers to search with
   * @param base The starting point
   */
  static async bulkScanDir(handlers: ScanHandler[], base: string) {
    const res = await Promise.all(handlers.map(x => this.scanDir(x, base)));
    const names = new Set();
    const out: ScanEntry[] = [];
    for (const ls of res) {
      for (const e of ls) {
        if (!names.has(e.file)) {
          names.add(e.file);
          out.push(e);
        }
      }
    }
    return out;
  }

  /**
   * Same as scanDir, but synchronous
   * @param handler Handler to search with
   * @param base The starting point
   */
  static scanDirSync(handler: ScanHandler, base: string) {
    const visited = new Set<string>();
    const out: ScanEntry[] = [];
    const dirs: ScanEntry[] = [
      { file: base, children: [] as ScanEntry[] } as ScanEntry
    ];

    while (dirs.length) {
      const dir = dirs.shift()!;
      inner: for (const file of fs.readdirSync(dir.file)) {
        if (file.startsWith('.')) {
          continue inner;
        }

        let full = FsUtil.resolveUnix(dir.file, file);
        if (handler.resolvePath) {
          full = handler.resolvePath(full);
        }
        const stats = fs.lstatSync(full);
        const subEntry: ScanEntry = { stats, file: full, module: full.replace(`${base}/`, '') };

        if (this.isDir(subEntry)) {
          if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
            if (subEntry.stats.isSymbolicLink()) {
              const p = fs.realpathSync(full);
              if (!visited.has(p)) {
                visited.add(p);
              } else {
                continue inner;
              }
            }
            subEntry.children = [];
            out.push(subEntry);
            dirs.push(subEntry);
          }
        } else {
          if (!handler.testFile || handler.testFile(subEntry.module, subEntry)) {
            (dir.children = dir.children ?? []).push(subEntry);
            out.push(subEntry);
          }
        }
      }
    }
    return out;
  }

  /**
   * Scan folders multiple times, once per handler, and union the results, synchronously
   * @param handlers Handlers to search with
   * @param base The starting point
   */
  static bulkScanDirSync(handlers: ScanHandler[], base: string) {
    const names = new Set();
    const out = [];
    for (const h of handlers) {
      for (const e of this.scanDirSync(h, base)) {
        if (!names.has(e.file)) {
          names.add(e.file);
          out.push(e);
        }
      }
    }
    return out;
  }
}