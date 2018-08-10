import * as path from 'path';

import { ScanEntry, ScanFs } from './scan-fs';
import { Env } from './env';
import { resolveFrameworkFile } from './app-info';

const cache: { [key: string]: ScanEntry[] } = {};

export class ScanApp {

  static findFiles(ext: string | RegExp, filter?: RegExp | ((rel: string) => boolean)) {
    const key = typeof ext === 'string' ? ext : ext.source;
    const testFile = typeof ext === 'string' ? (x: string) => x.endsWith(ext) : (x: string) => ext.test(x);

    if (!cache[key]) {
      cache[key] = ScanFs.scanDirSync({
        testFile,
        testDir: x =>
          !x.includes('node_modules') ||
          x.endsWith('node_modules') ||
          x.includes('@travetto')
      }, Env.cwd)
        .filter(ScanFs.isNotDir);

      if (Env.frameworkDev) {
        cache[key] = cache[key].map(x => {
          x.file = resolveFrameworkFile(x.file);
          x.module = x.file.replace(`${Env.cwd}${path.sep}`, '').replace(/[\\]+/g, '/');
          return x;
        });
      }

      // De-deduplicate
      cache[key] = cache[key]
        .sort((a, b) => a.file.localeCompare(b.file))
        .reduce((acc: ScanEntry[], x: ScanEntry) => {
          if (!acc.length || x.file !== acc[acc.length - 1].file) {
            acc.push(x);
          }
          return acc;
        }, []);
    }

    if (filter) {
      if (filter instanceof RegExp) {
        return cache[key].filter(x => filter.test(x.module));
      } else {
        return cache[key].filter(x => filter(x.module));
      }
    } else {
      return cache[key].slice(0);
    }
  }

  static requireFiles(ext: string | RegExp, filter: RegExp | ((rel: string) => boolean)) {
    return ScanApp.findFiles(ext, filter).map(x => require(x.file.replace(/[\\]/g, '/')));
  }
}