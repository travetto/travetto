import { lstatSync, readdirSync, realpathSync, Stats } from 'fs';
import * as fs from 'fs/promises';

import { FsUtil } from './fs';
import { PathUtil } from './path';

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
  stats?: Stats;
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

  /**
   * Should hidden files be traversed
   */
  withHidden?: boolean;
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
    return x.stats && (x.stats.isDirectory() || x.stats.isSymbolicLink());
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
    const dirs: ScanEntry[] = [];

    if (await FsUtil.exists(base)) {
      dirs.push({ file: base, children: [], module: '' });
    }

    while (dirs.length) {
      const dir = dirs.shift()!;
      inner: for (const file of (await fs.readdir(dir.file))) {
        if (file === '.' || file === '..' || file === '.bin' || (file.startsWith('.') && !handler.withHidden)) {
          continue inner;
        }

        let full = PathUtil.resolveUnix(dir.file, file);
        if (handler.resolvePath) {
          full = handler.resolvePath(full);
        }
        const stats = await fs.lstat(full);
        const subEntry: ScanEntry & { module: string } = { stats, file: full, module: full.replace(`${base}/`, '') };

        if (this.isDir(subEntry)) {
          if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
            if (this.isDir(subEntry)) {
              const p = await fs.realpath(full);
              if (!visited.has(p)) {
                visited.add(p);
              } else {
                continue inner;
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
   * Same as scanDir, but synchronous
   * @param handler Handler to search with
   * @param base The starting point
   */
  static scanDirSync(handler: ScanHandler, base: string) {
    const visited = new Set<string>();
    const out: ScanEntry[] = [];
    const dirs: ScanEntry[] = [];

    if (FsUtil.existsSync(base)) {
      dirs.push({ file: base, children: [], module: '' });
    }

    while (dirs.length) {
      const dir = dirs.shift()!;
      inner: for (const file of readdirSync(dir.file)) {
        if (file === '.' || file === '..' || file === '.bin' || (file.startsWith('.') && !handler.withHidden)) {
          continue inner;
        }

        let full = PathUtil.resolveUnix(dir.file, file);
        if (handler.resolvePath) {
          full = handler.resolvePath(full);
        }
        const stats = lstatSync(full);
        const subEntry: ScanEntry & { module: string } = { stats, file: full, module: full.replace(`${base}/`, '') };

        if (this.isDir(subEntry)) {
          if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
            if (this.isDir(subEntry)) {
              const p = realpathSync(full);
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
}