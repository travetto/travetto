import { FsUtil, RegisterUtil } from '@travetto/boot';

import { Env } from './env';
import { ScanEntry, ScanFs } from './scan-fs';
import { SystemUtil } from './system-util';

type SimpleEntry = Pick<ScanEntry, 'file' | 'module'>;

type Pred = (val: string) => boolean;

interface Tester {
  source: string;
  test(value: string): boolean;
}

export class ScanApp {

  private static CACHE = new Map<string, SimpleEntry[]>();

  static TS_TESTER: Tester = {
    source: '.ts',
    test: x => x.endsWith('.ts') && !x.endsWith('.d.ts')
  };

  private static resolveFramework(x: SimpleEntry, root: string) {
    const file = RegisterUtil.devResolve(x.file);
    return { ...x, file, module: file.replace(`${root}/`, '') };
  }

  /**
   * Clears the app scanning cache
   */
  static clearCache() {
    this.CACHE.clear();
  }

  /**
   * Find files by extension/pattern
   * @param ext Extension (including '.') or a object with a test method {@type Tester}
   * @param filter Any additional filters, external to the extension.  Caching occurs at the extension level
   * @param root Starting point for finding files, defaults to cwd
   */
  static findFiles(ext: string | Tester, filter?: RegExp | Pred, root = Env.cwd): SimpleEntry[] {
    ext = ext === '.ts' ? this.TS_TESTER : ext; // Exclude .d.ts when .ts passed in

    const key = root + (typeof ext === 'string' ? ext : ext.source);
    const testFile: Pred = typeof ext === 'string' ? x => x.endsWith(ext as string) : x => (ext as Tester).test(x);

    if (!this.CACHE.has(key)) {
      let toCache: SimpleEntry[] = ScanFs.scanDirSync({
        testFile,
        testDir: x => // Ensure its a valid folder or module folder
          !x.includes('node_modules') || // All non-framework folders
          x.endsWith('node_modules') || // Is first level node_modules
          x.includes('@travetto')  // Is framework folder, include everything under it
      }, root)
        .filter(ScanFs.isNotDir);

      // Align with framework dev
      toCache = toCache.map(x => this.resolveFramework(x, root)); // @TRV_DEV

      // De-deduplicate
      toCache = toCache
        .sort((a, b) => a.file.localeCompare(b.file))
        .reduce((acc: SimpleEntry[], x: SimpleEntry) => {
          if (!acc.length || x.file !== acc[acc.length - 1].file) {
            acc.push(x);
          }
          return acc;
        }, []);

      this.CACHE.set(key, toCache);
    }

    if (filter) {
      if (filter instanceof RegExp) {
        return this.CACHE.get(key)!.filter(x => filter.test(x.module));
      } else {
        return this.CACHE.get(key)!.filter(x => filter(x.module));
      }
    } else {
      return this.CACHE.get(key)!.slice(0);
    }
  }

  static activeAppPaths(roots: string[] = ['.'], mainSet = ['src', 'extension']) {
    if (Env.env === 'test') {
      mainSet.push('test');
    }

    const [main, ...rest] = roots;
    return [
      ...rest.map(x => FsUtil.joinUnix(x, 'src')),
      ...mainSet.map(x => FsUtil.joinUnix(main, x))
    ];
  }

  static findActiveAppFiles(roots: string[] = ['.'], exclude?: (file: string) => boolean, root = Env.cwd, mainSet = ['src', 'extension']) {
    const PATH_RE = SystemUtil.pathMatcher(this.activeAppPaths(roots, mainSet));

    const result = this.findFiles('.ts',
      f =>
        !/@travetto\/cli/.test(f) && // Exclude CLI
        (!exclude || !exclude(f)) && // Exclude any filtered items
        (
          PATH_RE.test(f) || ( // Match a root file or
            /node_modules\/(@travetto\/[^\/]+\/((src|extension)\/|index))/.test(f) // a module with src/, extension/ or index
          )
        )
      , root
    )
      .map(x => x.file);

    return result;
  }

  static setFileEntries(key: string, paths: string[], base: string = Env.cwd) {
    const results = paths.map(mod => {
      // Compressed for minimizing bundle size
      mod = FsUtil.toUnix(mod).replace('#', 'node_modules/@travetto');

      const full = FsUtil.resolveUnix(base!, mod);

      if (mod === full) {
        mod = full.replace(`${base}/`, '');
      }
      return { file: full, module: mod };
    });

    this.CACHE.set(key, results);
  }
}