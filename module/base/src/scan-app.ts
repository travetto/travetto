import { FsUtil, RegisterUtil, EnvUtil } from '@travetto/boot';

import { Env } from './env';
import { ScanEntry, ScanFs } from './scan-fs';

type SimpleEntry = Pick<ScanEntry, 'file' | 'module'>;

const IS_TRAVETTO_MODULE = (x: string) =>
  !x.includes('node_modules') ||
  x.endsWith('node_modules') ||
  x.includes('@travetto');

interface Tester {
  source: string;
  test(value: string): boolean;
}

export class ScanApp {

  static cache: Record<string, SimpleEntry[]> = {};
  static TS_TESTER: Tester = {
    source: '.ts',
    test: x => x.endsWith('.ts') && !x.endsWith('.d.ts')
  };

  static IS_STANDARD_APP_FILE = (x: string) =>
    /^(src\/|support\/|index)/.test(x) ||
    /(@travetto\/[^\/]+\/(src\/|support\/|index))/.test(x); // Is an index file/folder;

  static findFiles(ext: string | Tester, filter?: RegExp | ((rel: string) => boolean), root = Env.cwd): SimpleEntry[] {
    ext = ext === '.ts' ? this.TS_TESTER : ext; // Exclude .d.ts when .ts passed in

    const key = root + (typeof ext === 'string' ? ext : ext.source);
    const testFile = typeof ext === 'string' ? (x: string) => x.endsWith(ext as string) : (x: string) => (ext as Tester).test(x);

    if (!this.cache[key]) {
      this.cache[key] = ScanFs.scanDirSync({
        testFile,
        testDir: IS_TRAVETTO_MODULE
      }, root)
        .filter(ScanFs.isNotDir);

      if (EnvUtil.isSet('trv_framework_dev')) {
        this.cache[key] = this.cache[key].map(x => {
          x.file = RegisterUtil.resolveFrameworkDevFile(x.file);
          x.module = FsUtil.toUnix(x.file).replace(`${root}/`, '');
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

  static requireFiles(ext: string | RegExp, filter: RegExp | ((rel: string) => boolean), root = Env.cwd) {
    return this.findFiles(ext, filter, root).map(x => require(x.file));
  }

  static setFileEntries(key: string, paths: string[], base: string = Env.cwd) {
    this.cache[key] = paths.map(mod => {
      mod = FsUtil.toUnix(mod).replace('#', 'node_modules/@travetto'); // Compressed for minimizing bundle size

      const full = FsUtil.resolveUnix(base!, mod);

      if (mod === full) {
        mod = full.replace(`${base}/`, '');
      }
      return { file: full, module: mod };
    });
  }

  static getStandardAppFiles() {
    return this.findFiles('.ts', this.IS_STANDARD_APP_FILE)
      .map(x => x.file);
  }
}