import * as fs from 'fs';

import { FsUtil } from './fs-util';

export interface ScanEntry {
  uri: string;
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

  static scanDir(handler: ScanHandler, base: string, entry?: ScanEntry, visited = new Set()) {
    return new Promise<ScanEntry[]>(async (resolve, reject) => {

      try {
        const out: ScanEntry[] = [];

        entry = (entry || { file: base, children: [] }) as ScanEntry;

        for (const file of (await FsUtil.readdir(entry.uri))) {
          if (file.startsWith('.')) {
            continue;
          }

          const uri = FsUtil.resolveURI(entry.uri, file);

          const stats = await FsUtil.stat(uri);
          const subEntry: ScanEntry = {
            stats,
            uri,
            module: uri.replace(`${base}/`, '')
          };

          if (ScanFs.isDir(subEntry)) {
            if (subEntry.stats.isSymbolicLink()) {
              const p = await FsUtil.realpath(uri);
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

  static async bulkScanDir(handlers: ScanHandler[], base: string) {
    const res = await Promise.all(handlers.map(x => ScanFs.scanDir(x, base)));
    const names = new Set<string>();
    const out = [];
    for (const ls of res) {
      for (const e of ls) {
        if (!names.has(e.uri)) {
          names.add(e.uri);
          out.push(e);
        }
      }
    }
    return out;
  }

  static scanDirSync(handler: ScanHandler, base: string, entry?: ScanEntry, visited = new Set()) {
    const out: ScanEntry[] = [];

    entry = (entry || { file: base, children: [] }) as ScanEntry;

    for (const file of FsUtil.readdirSync(entry.uri)) {
      if (file.startsWith('.')) {
        continue;
      }

      const uri = FsUtil.resolveURI(entry.uri, file);

      const stats = FsUtil.statSync(uri);
      const subEntry: ScanEntry = {
        stats,
        uri,
        module: uri.replace(`${base}/`, '')
      };

      if (ScanFs.isDir(subEntry)) {
        if (subEntry.stats.isSymbolicLink()) {
          const p = FsUtil.realpathSync(uri);
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

  static bulkScanDirSync(handlers: ScanHandler[], base: string) {
    const names = new Set<string>();
    const out = [];
    for (const h of handlers) {
      for (const e of ScanFs.scanDirSync(h, base)) {
        if (!names.has(e.uri)) {
          names.add(e.uri);
          out.push(e);
        }
      }
    }
    return out;
  }

  static bulkRequire<T = any>(handlers: ScanHandler[], cwd: string): T[] {
    return ScanFs.bulkScanDirSync(handlers, cwd)
      .filter(ScanFs.isNotDir) // Skip folders
      .map(x => require(x.module))
      .filter(x => !!x); // Return non-empty values
  }

  static async bulkRead(handlers: ScanHandler[], base: string) {
    const files = await ScanFs.bulkScanDir(handlers, base);
    const promises = files
      .filter(ScanFs.isNotDir)
      .map(x => FsUtil.readFile(x.uri).then(d => ({ name: x.uri, data: d.toString() })));
    return await Promise.all(promises);
  }

  static bulkReadSync(handlers: ScanHandler[], base: string) {
    return ScanFs.bulkScanDirSync(handlers, base)
      .filter(ScanFs.isNotDir)
      .map(x => ({ name: x.uri, data: FsUtil.readFileSync(x.uri).toString() }));
  }
}