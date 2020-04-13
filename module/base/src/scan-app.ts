import { FsUtil, RegisterUtil } from '@travetto/boot';

import { Env } from './env';
import { ScanEntry, ScanFs } from './scan-fs';
import { SystemUtil } from './system-util';

type SimpleEntry = Pick<ScanEntry, 'file' | 'module'>;

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

  /**
   * Find files by extension/pattern
   * @param ext Extension (including '.') or a object with a test method {@type Tester}
   * @param filter Any additional filters, external to the extension.  Caching occurs at the extension level
   * @param root Starting point for finding files, defaults to cwd
   */
  static findFiles(ext: string | Tester, filter?: RegExp | ((rel: string) => boolean), root = Env.cwd): SimpleEntry[] {
    ext = ext === '.ts' ? this.TS_TESTER : ext; // Exclude .d.ts when .ts passed in

    const key = root + (typeof ext === 'string' ? ext : ext.source);
    const testFile = typeof ext === 'string' ? (x: string) => x.endsWith(ext as string) : (x: string) => (ext as Tester).test(x);

    if (!this.cache[key]) {
      this.cache[key] = ScanFs.scanDirSync({
        testFile,
        testDir: x => // Ensure its a valid folder or module folder
          !x.includes('node_modules') || // All non-framework folders
          x.endsWith('node_modules') || // Is first level node_modules
          x.includes('@travetto')  // Is framework folder, include everything under it
      }, root)
        .filter(ScanFs.isNotDir);

      if (TRV_FRAMEWORK_DEV) {
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

  static findActiveAppFiles(roots: string[], exclude?: (file: string) => boolean, root = Env.cwd) {
    const [main, ...rest] = roots;
    const PATH_RE = SystemUtil.pathMatcher([
      ...rest.map(x => FsUtil.joinUnix(x, 'src')),
      ...['src', 'extension'].map(x => FsUtil.joinUnix(main, x))
    ]);

    const result = this.findFiles('.ts',
      f =>
        !/@travetto\/cli/.test(f) &&
        (!exclude || !exclude(f)) &&
        (
          PATH_RE.test(f) || (
            /node_modules\/(@travetto\/[^\/]+\/((src|extension)\/|index))/.test(f) // Only import framework files
          )
        )
      , root
    )
      .map(x => x.file);

    return result;
  }

  static setFileEntries(key: string, paths: string[], base: string = Env.cwd) {
    this.cache[key] = paths.map(mod => {
      // Compressed for minimizing bundle size
      mod = FsUtil.toUnix(mod).replace('#', 'node_modules/@travetto');

      const full = FsUtil.resolveUnix(base!, mod);

      if (mod === full) {
        mod = full.replace(`${base}/`, '');
      }
      return { file: full, module: mod };
    });
  }
}