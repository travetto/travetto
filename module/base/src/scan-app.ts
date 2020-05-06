import { FsUtil, AppCache } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';

import { Env } from './env';
import { ScanEntry, ScanFs } from './scan-fs';
import { SystemUtil } from './internal/system';

type SimpleEntry = Pick<ScanEntry, 'file' | 'module'>;

type Pred = (val: string) => boolean;

interface Tester {
  source: string;
  test(value: string): boolean;
}

/**
 * File scanning utilities, with a focus on application execution
 */
export class ScanApp {

  private static CACHE = new Map<string, SimpleEntry[]>();

  /**
   * List of primary app folders to search
   */
  static mainAppFolders: string[] = ['src'];
  /**
   * List of module app folders to search
   */
  static modAppFolders: string[] = ['src'];
  /**
   * List of modules to not traverse into
   */
  static modAppExclude: string[] = ['test', 'cli', 'boot', 'watch'];

  /**
   * Provides a RegEx compatible object that can scan for typescript files quickly
   */
  static TS_TESTER: Tester = {
    source: '.ts',
    test: x => x.endsWith('.ts') && !x.endsWith('.d.ts')
  };

  /**
   * Support framework resolution if active
   */
  private static resolveFramework(x: SimpleEntry, root: string) {
    const file =
      FrameworkUtil.devResolve(x.file) || // @line-if $TRV_DEV
      x.file;
    return { ...x, file, module: file.replace(`${root}/`, '') };
  }

  /**
   * Get regex compatible tester for validating travetto modules in traversal
   */
  private static getAppModPathMatcher() {
    const MOD_MATCH = new RegExp(`node_modules/@travetto/([^/]+)/(${[...this.modAppFolders.map(x => `${x}/`), 'index'].join('|')})`);
    const MOD_EX = new RegExp(`@travetto/(${this.modAppExclude.join('|')})`);
    return { test: (x: string) => MOD_MATCH.test(x) && !MOD_EX.test(x) };
  }

  /**
   * Clears the app scanning cache
   */
  static reset() {
    this.CACHE.clear();
  }

  /**
   * Find all '.ts' files excluding ones identified by the filter
   */
  static findSourceFiles(filter?: Tester | Pred, root = Env.cwd): SimpleEntry[] {
    return this.findFiles(this.TS_TESTER, filter, root);
  }

  /**
   * Find files by extension/pattern
   * @param ext Extension (including '.') or a object with a test method {@type Tester}
   * @param filter Any additional filters, external to the extension.  Caching occurs at the extension level
   * @param root Starting point for finding files, defaults to cwd
   */
  static findFiles(ext: string | Tester, filter?: Tester | Pred, root = Env.cwd): SimpleEntry[] {
    ext = typeof ext === 'string' ? new RegExp(`${ext}$`) : ext;

    const key = `${root}:${ext.source}`;
    const testFile: Pred = ext.test.bind(ext);

    if (!this.CACHE.has(key)) {
      let toCache: SimpleEntry[] = ScanFs.scanDirSync({
        testFile,
        testDir: x => // Ensure its a valid folder or module folder
          !x.includes('node_modules') || // All non-framework folders
          x.endsWith('node_modules') || // Is first level node_modules
          x.includes('@travetto')  // Is framework folder, include everything under it
      }, root)
        .filter(x => ScanFs.isNotDir(x));

      // Align with framework dev
      toCache = toCache.map(x => this.resolveFramework(x, root)); // @line-if $TRV_DEV

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
      if ('test' in filter) {
        return this.CACHE.get(key)!.filter(x => filter.test(x.module));
      } else {
        return this.CACHE.get(key)!.filter(x => filter(x.module));
      }
    } else {
      return this.CACHE.get(key)!.slice(0);
    }
  }

  /**
   * Determine absolute paths of all application paths from app roots
   */
  static getAppPaths(roots = Env.appRoots, pathSet = ScanApp.mainAppFolders) {
    const [main, ...rest] = roots;
    return [
      ...rest.map(x => FsUtil.joinUnix(x, 'src')),
      ...pathSet.map(x => FsUtil.joinUnix(main, x)) // Only main app gets extensions
    ];
  }

  /**
   * Find app files, assuming provided root paths provided
   */
  static findAppFiles(rootPaths: string[], exclude?: (file: string) => boolean, root = Env.cwd) {
    const PATH_RE = SystemUtil.pathMatcher(rootPaths);
    const MOD_RE = this.getAppModPathMatcher();
    return this.findSourceFiles(
      // Exclude any filtered items, only return app files or module files
      f => (!exclude || !exclude!(f)) && (PATH_RE.test(f) || MOD_RE.test(f)),
      root
    ).map(x => x.file);
  }

  /**
   * Preload file entries, useful for precompiling and indexing
   */
  static setFileEntries(key: string, paths: string[], base: string = Env.cwd) {
    const results = paths.map(mod => {
      // Compressed for minimizing bundle size
      mod = !/•/.test(mod) ? mod : AppCache.fromEntryName(mod);
      const full = FsUtil.resolveUnix(base!, mod);

      if (mod === full) {
        mod = full.replace(`${base}/`, '');
      }
      return { file: full, module: mod };
    });

    this.CACHE.set(key, results);
  }
}