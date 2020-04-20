import { FsUtil, RegisterUtil } from '@travetto/boot';
import * as fs from 'fs';

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

  static mainAppFolders: string[] = ['src', 'extension'];
  static modAppFolders: string[] = ['src', 'extension', 'index'];
  static modAppExclude: string[] = ['test', 'cli'];

  static TS_TESTER: Tester = {
    source: '.ts',
    test: x => x.endsWith('.ts') && !x.endsWith('.d.ts')
  };

  private static resolveFramework(x: SimpleEntry, root: string) {
    const file = RegisterUtil.devResolve(x.file);
    return { ...x, file, module: file.replace(`${root}/`, '') };
  }

  private static getAppModPathMatcher(root = Env.cwd) {
    const MOD_RE = new RegExp(`^node_modules/@travetto/(${
      fs.readdirSync(`${root}/node_modules/@travetto`)
        .filter(x => !x.startsWith('.') && !this.modAppExclude.includes(x))
        .join('|')
      // eslint-disable-next-line @typescript-eslint/indent
      })/(${this.modAppFolders.join('|')})`);

    return MOD_RE;
  }

  /**
   * Clears the app scanning cache
   */
  static clearCache() {
    this.CACHE.clear();
  }

  static findSourceFiles(filter?: RegExp | Pred, root = Env.cwd): SimpleEntry[] {
    return this.findFiles(this.TS_TESTER, filter, root);
  }

  /**
   * Find files by extension/pattern
   * @param ext Extension (including '.') or a object with a test method {@type Tester}
   * @param filter Any additional filters, external to the extension.  Caching occurs at the extension level
   * @param root Starting point for finding files, defaults to cwd
   */
  static findFiles(ext: string | Tester, filter?: RegExp | Pred, root = Env.cwd): SimpleEntry[] {
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
    const MOD_RE = this.getAppModPathMatcher(root);
    return this.findSourceFiles(
      // Exclude any filtered items, only return app files or module files
      f => (!exclude || !exclude!(f)) && (PATH_RE.test(f) || MOD_RE.test(f)),
      root
    ).map(x => x.file);
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