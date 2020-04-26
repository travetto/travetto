import * as fs from 'fs';
import * as util from 'util';

import { FsUtil } from '@travetto/boot';

const fsReaddir = util.promisify(fs.readdir);
const fsLstat = util.promisify(fs.lstat);
const fsRealpath = util.promisify(fs.realpath);
const fsReadFile = util.promisify(fs.readFile);

export interface ScanEntry {
  file: string;
  module: string;
  stats: fs.Stats;
  children?: ScanEntry[];
}

export interface ScanHandler {
  testFile?(relative: string, entry?: ScanEntry): boolean;
  testDir?(relative: string, entry?: ScanEntry): boolean;
}

export interface ReadEntry {
  name: string;
  data: string;
}

/**
 * File system scanning utilities
 */
export class ScanFs {

  static isDir(x: ScanEntry) {
    return x.stats.isDirectory() || x.stats.isSymbolicLink();
  }

  static isNotDir(x: ScanEntry) {
    return !x.stats.isDirectory() && !x.stats.isSymbolicLink();
  }

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

        const full = FsUtil.resolveUnix(dir.file, file);
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

        const full = FsUtil.resolveUnix(dir.file, file);
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

  static bulkRequire(handlers: ScanHandler[], cwd: string) {
    return this.bulkScanDirSync(handlers, cwd)
      .filter(x => this.isNotDir(x)) // Skip folders
      .map(x => require(x.file))
      .filter(x => !!x); // Return non-empty values
  }

  static async bulkRead(handlers: ScanHandler[], base: string) {
    const files = await this.bulkScanDir(handlers, base);
    const promises = files
      .filter(x => this.isNotDir(x))
      .map(x => fsReadFile(x.file, 'utf-8').then(d => ({ name: x.file, data: d })));
    return await Promise.all(promises);
  }

  static bulkReadSync(handlers: ScanHandler[], base: string) {
    return this.bulkScanDirSync(handlers, base)
      .filter(x => this.isNotDir(x))
      .map(x => ({ name: x.file, data: fs.readFileSync(x.file, 'utf-8') }));
  }
}