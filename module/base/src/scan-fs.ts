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

class $ScanFs {

  constructor() {
    for (const el of Object.keys(this) as (keyof this)[]) {
      if (this[el] && (this[el] as any).bind) {
        this[el] = (this[el] as any).bind(this);
      }
    }
  }

  isDir(x: ScanEntry) {
    return x.stats.isDirectory() || x.stats.isSymbolicLink();
  }

  isNotDir(x: ScanEntry) {
    return !x.stats.isDirectory() && !x.stats.isSymbolicLink();
  }

  async scanDir(handler: ScanHandler, base: string, entry?: ScanEntry, visited = new Set<string>()) {
    const out: ScanEntry[] = [];

    entry = (entry! ?? { file: base, children: [] });

    for (const file of (await fsReaddir(entry!.file))) {
      if (file.startsWith('.')) {
        continue;
      }

      const full = FsUtil.resolveUnix(entry!.file, file);
      const stats = await fsLstat(full);
      const subEntry = { stats, file: full, module: full.replace(`${base}/`, '') };

      if (this.isDir(subEntry)) {
        if (subEntry.stats.isSymbolicLink()) {
          const p = await fsRealpath(full);
          if (!visited.has(p)) {
            visited.add(p);
          } else {
            continue;
          }
        }

        if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
          out.push(subEntry, ...await this.scanDir(handler, base, subEntry, visited));
        }
      } else if (!handler.testFile || handler.testFile(subEntry.module, subEntry)) {
        (entry!.children = entry?.children ?? []).push(subEntry);
        out.push(subEntry);
      }
    }
    return out;
  }

  async bulkScanDir(handlers: ScanHandler[], base: string) {
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

  scanDirSync(handler: ScanHandler, base: string, entry?: ScanEntry, visited = new Set<string>()) {
    const out: ScanEntry[] = [];

    entry = (entry! ?? { file: base, children: [] });

    for (const file of fs.readdirSync(entry.file)) {
      if (file.startsWith('.')) {
        continue;
      }

      const full = FsUtil.resolveUnix(entry.file, file);
      const stats = fs.lstatSync(full);
      const subEntry = { stats, file: full, module: full.replace(`${base}/`, '') };

      if (this.isDir(subEntry)) {
        if (subEntry.stats.isSymbolicLink()) {
          const p = fs.realpathSync(full);
          if (!visited.has(p)) {
            visited.add(p);
          } else {
            continue;
          }
        }
        if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
          out.push(subEntry, ...this.scanDirSync(handler, base, subEntry, visited));
        }
      } else if (!handler.testFile || handler.testFile(subEntry.module, subEntry)) {
        (entry.children = entry.children ?? []).push(subEntry);
        out.push(subEntry);
      }
    }
    return out;
  }

  bulkScanDirSync(handlers: ScanHandler[], base: string) {
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

  bulkRequire(handlers: ScanHandler[], cwd: string) {
    return this.bulkScanDirSync(handlers, cwd)
      .filter(this.isNotDir) // Skip folders
      .map(x => require(x.file))
      .filter(x => !!x); // Return non-empty values
  }

  async bulkRead(handlers: ScanHandler[], base: string) {
    const files = await this.bulkScanDir(handlers, base);
    const promises = files
      .filter(this.isNotDir)
      .map(x => fsReadFile(x.file, 'utf-8').then(d => ({ name: x.file, data: d })));
    return await Promise.all(promises);
  }

  bulkReadSync(handlers: ScanHandler[], base: string) {
    return this.bulkScanDirSync(handlers, base)
      .filter(this.isNotDir)
      .map(x => ({ name: x.file, data: fs.readFileSync(x.file, 'utf-8') }));
  }
}

export const ScanFs = new $ScanFs();