import { Env } from './bootstrap/env';
import { FsUtil } from './bootstrap/fs-util';
import { ScanEntry, ScanFs } from './bootstrap/scan-fs';

type SimpleEntry = Pick<ScanEntry, 'file' | 'module'>;

export class ScanApp {

  static cache: { [key: string]: SimpleEntry[] } = {};

  static findFiles(ext: string | RegExp, filter?: RegExp | ((rel: string) => boolean)): SimpleEntry[] {
    const key = typeof ext === 'string' ? ext : ext.source;
    const testFile = typeof ext === 'string' ? (x: string) => x.endsWith(ext) : (x: string) => ext.test(x);

    if (!this.cache[key]) {
      this.cache[key] = ScanFs.scanDirSync({
        testFile,
        testDir: x =>
          !x.includes('node_modules') ||
          x.endsWith('node_modules') ||
          x.includes('@travetto')
      }, Env.cwd)
        .filter(ScanFs.isNotDir);

      if (process.env.TRV_FRAMEWORK_DEV) {
        this.cache[key] = this.cache[key].map(x => {
          x.file = FsUtil.resolveFrameworkDevFile(x.file);
          x.module = FsUtil.toUnix(x.file).replace(`${Env.cwd}/`, '');
          return x;
        });
      }

      // De-deduplicate
      this.cache[key] = this.cache[key]
        .sort((a, b) => a.file.localeCompare(b.file))
        .reduce((acc: SimpleEntry[], x: SimpleEntry) => {
          if (!acc.length || x.file !== acc[acc.length - 1].file) {
            acc.push(x);
          }
          return acc;
        }, []);
    }

    if (filter) {
      if (filter instanceof RegExp) {
        return this.cache[key].filter(x => filter.test(x.module));
      } else {
        return this.cache[key].filter(x => filter(x.module));
      }
    } else {
      return this.cache[key].slice(0);
    }
  }

  static requireFiles(ext: string | RegExp, filter: RegExp | ((rel: string) => boolean)) {
    return ScanApp.findFiles(ext, filter).map(x => require(x.file));
  }

  static setFileEntries(key: string, paths: string[], base: string = Env.cwd) {
    this.cache[key] = paths.map(mod => {
      mod = FsUtil.toUnix(mod).replace('#', 'node_modules/@travetto');

      const full = FsUtil.resolveUnix(base!, mod);

      if (mod === full) {
        mod = full.replace(`${base}/`, '');
      }
      return { file: full, module: mod };
    });
  }

  static getStandardAppFiles() {
    const res = ScanApp
      .findFiles('.ts', x =>
        !x.endsWith('.d.ts') && (
          /^(src\/|support\/|index)/.test(x) ||
          /(@travetto\/[^\/]+\/(src\/|support\/|index))/.test(x)
        ) && !x.includes('@travetto/test'))
      .map(x => x.file);
    return res;
  }
}