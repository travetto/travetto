import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { Env } from './env';

const fsReadFileAsync = util.promisify(fs.readFile);
const fsStat = util.promisify(fs.lstat);
const fsReaddir = util.promisify(fs.readdir);
const fsRealpath = util.promisify(fs.realpath);

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

export class ScanFs {

  static isDir(x: ScanEntry) {
    return x.stats.isDirectory() || x.stats.isSymbolicLink();
  }

  static isNotDir(x: ScanEntry) {
    return !x.stats.isDirectory() && !x.stats.isSymbolicLink();
  }

  static scanDir(handler: ScanHandler, base?: string, entry?: ScanEntry, visited = new Set()) {
    return new Promise<ScanEntry[]>(async (resolve, reject) => {

      try {
        const out: ScanEntry[] = [];

        base = base || Env.cwd;
        entry = (entry || { file: base, children: [] }) as ScanEntry;

        for (const file of (await fsReaddir(entry.file))) {
          if (file.startsWith('.')) {
            continue;
          }

          const full = path.resolve(entry.file, file);
          const stats = await fsStat(full);
          const subEntry: ScanEntry = { stats, file: full, module: full.replace(`${base}${path.sep}`, '').replace(/[\\]+/g, '/') };

          if (ScanFs.isDir(subEntry)) {
            if (subEntry.stats.isSymbolicLink()) {
              const p = await fsRealpath(full);
              if (!visited.has(p)) {
                visited.add(p);
              } else {
                continue;
              }
            }

            if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
              out.push(subEntry, ...await ScanFs.scanDir(handler, base, subEntry, visited));
            }
          } else if (!handler.testFile || handler.testFile(subEntry.module, subEntry)) {
            (entry.children = entry.children || [])!.push(subEntry);
            out.push(subEntry);
          }
        }
        resolve(out);
      } catch (e) {
        reject(e);
      }
    });
  }

  static async bulkScanDir(handlers: ScanHandler[], base?: string) {
    const res = await Promise.all(handlers.map(x => ScanFs.scanDir(x, base)));
    const names = new Set<string>();
    const out = [];
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

  static scanDirSync(handler: ScanHandler, base?: string, entry?: ScanEntry, visited = new Set()) {
    const out: ScanEntry[] = [];

    base = base || Env.cwd;
    entry = (entry || { file: base, children: [] }) as ScanEntry;

    for (const file of fs.readdirSync(entry.file)) {
      if (file.startsWith('.')) {
        continue;
      }

      const full = path.resolve(entry.file, file);
      const stats = fs.lstatSync(full);
      const subEntry: ScanEntry = { stats, file: full, module: full.replace(`${base}${path.sep}`, '').replace(/[\\]+/g, '/') };

      if (ScanFs.isDir(subEntry)) {
        if (subEntry.stats.isSymbolicLink()) {
          const p = fs.realpathSync(full);
          if (!visited.has(p)) {
            visited.add(p);
          } else {
            continue;
          }
        }
        if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
          out.push(subEntry, ...ScanFs.scanDirSync(handler, base, subEntry, visited));
        }
      } else if (!handler.testFile || handler.testFile(subEntry.module, subEntry)) {
        (entry.children = entry.children || [])!.push(subEntry);
        out.push(subEntry);
      }
    }
    return out;
  }

  static bulkScanDirSync(handlers: ScanHandler[], base?: string) {
    const names = new Set<string>();
    const out = [];
    for (const h of handlers) {
      for (const e of ScanFs.scanDirSync(h, base)) {
        if (!names.has(e.file)) {
          names.add(e.file);
          out.push(e);
        }
      }
    }
    return out;
  }

  static bulkRequire<T = any>(handlers: ScanHandler[], cwd?: string): T[] {
    return ScanFs.bulkScanDirSync(handlers, cwd)
      .filter(ScanFs.isNotDir) // Skip folders
      .map(x => require(x.file.replace(/[\\]+/g, '/')))
      .filter(x => !!x); // Return non-empty values
  }

  static async bulkRead(handlers: ScanHandler[]) {
    const files = await ScanFs.bulkScanDir(handlers);
    const promises = files
      .filter(ScanFs.isNotDir)
      .map(x => fsReadFileAsync(x.file).then(d => ({ name: x.file, data: d.toString() })));
    return await Promise.all(promises);
  }

  static bulkReadSync(handlers: ScanHandler[]) {
    return ScanFs.bulkScanDirSync(handlers)
      .filter(ScanFs.isNotDir)
      .map(x => ({ name: x.file, data: fs.readFileSync(x.file).toString() }));
  }
}