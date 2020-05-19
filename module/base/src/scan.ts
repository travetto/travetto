import { ScanEntry, ScanFs, FsUtil, AppCache } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';

import { Env } from './env';

type SimpleEntry = Pick<ScanEntry, 'module' | 'file'>;

type FindConfig =
  { folder?: string, filter?: Tester, rootPaths: string[] } |
  { folder?: string, filter?: Tester, appRoots?: string[] };

type AppFindConfig = { folder?: string, filter?: Tester, appRoots?: string[] };

interface Tester {
  source: string;
  test(value: string): boolean;
}

/**
 * File scanning utilities, with a focus on application execution
 */
export class ScanApp {

  private static __INDEX: Map<string, { index?: SimpleEntry, base: string, files: Map<string, SimpleEntry[]> }>;
  private static CACHE = new Map<string, SimpleEntry[]>();

  /**
   * List of primary app folders to search
   */
  static mainAppFolders: string[] = ['src'];
  /**
   * List of modules to not traverse into
   */
  static modAppExclude: string[] = ['test', 'cli', 'boot', 'watch'];

  /**
   * Compute index for a scan entry
   * @param entry
   */
  static computeIndex(entry: ScanEntry) {
    const file = entry.module;
    if (file.includes('node_modules')) {
      if (file.includes('@travetto/')) { // External module
        const mod = file.replace(/^.*node_modules\/(@travetto\/[^/]+)(\/?.*?)$/, (a, b) => b);
        if (mod.includes('node_modules')) {
          return;
        } else if (entry.stats.isDirectory() || entry.stats.isSymbolicLink()) {
          return { mod, sub: '' };
        } else {
          const [sub] = file.split(`${mod}/`)[1].split('/');
          return { mod, sub };
        }
      }
    } else if (/^alt(\/.*)$/.test(file)) { // Alt app
      if (file === 'alt') {
        return;
      }
      const mod = file.split('alt/')[1].split('/')[0];
      if (entry.stats.isDirectory() || entry.stats.isSymbolicLink()) {
        return { mod, sub: '' };
      } else {
        const [sub] = file.split(`${mod}/`)[1].split('/');
        return { mod, sub };
      }
    } else { // Core app
      const mod = '.';
      const [sub] = file.split('/');
      return { mod, sub };
    }
  }

  /**
   * Get the map of all modules currently supported in the application
   */
  static get index() {
    if (this.__INDEX === undefined) {
      this.__INDEX = new Map([['.', { base: FsUtil.cwd, files: new Map() }]]);
      for (const el of ScanFs.scanFramework(x => !x.endsWith('.d.ts') && x.endsWith('.ts'))) {
        const res = this.computeIndex(el);
        if (!res) {
          continue;
        }

        const { mod, sub } = res;

        el.file = FrameworkUtil.devResolve(el.file); // @line-if $TRV_DEV
        el.module = el.file.replace(`${FsUtil.cwd}/`, ''); // @line-if $TRV_DEV

        if (el.stats.isDirectory() || el.stats.isSymbolicLink()) {
          if (!this.__INDEX.has(mod)) {
            this.__INDEX.set(mod, { base: el.file, files: new Map() });
          }
        } else if (sub === 'index.ts') {
          this.__INDEX.get(mod)!.index = el;
        } else {
          if (!this.__INDEX.get(mod)!.files.has(sub)) {
            this.__INDEX.get(mod)!.files.set(sub, []);
          }
          this.__INDEX.get(mod)!.files.get(sub)!.push({ file: el.file, module: el.module });
        }
      }
    }
    return this.__INDEX;
  }

  /**
   * Clears the app scanning cache
   */
  static reset() {
    this.CACHE.clear();
    this.__INDEX.clear();
  }

  /**
   * Finnd search keys
   * @param appRoots App paths
   */
  static getRootPaths(appRoots?: string[]) {
    return [...this.index.keys()]
      .filter(key => (key.startsWith('@travetto') && !this.modAppExclude.includes(key)) || (appRoots || Env.appRoots).includes(key));
  }

  /**
   * Find all folders for the given root paths
   * @param rootPaths The root paths to check
   * @param folder The folder to check into
   */
  static findFolders(config: FindConfig) {
    const all: string[] = [];
    const paths = 'rootPaths' in config ? config.rootPaths : this.getRootPaths(config.appRoots);
    for (const key of paths) {
      if (this.index.has(key)) {
        if (config.folder) {
          all.push(FsUtil.resolveUnix(this.index.get(key)!.base, config.folder));
        } else {
          all.push(this.index.get(key)!.base);
        }
      }
    }
    return all;

  }

  /**
   * Find files from the index
   * @param rootPaths The main application paths to check
   * @param folder The folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  static findFiles(config: FindConfig) {
    const { filter, folder } = config;
    const paths = 'rootPaths' in config ? config.rootPaths : this.getRootPaths(config.appRoots);
    const all: SimpleEntry[][] = [];
    const idx = this.index;
    for (const key of paths) {
      if (idx.has(key)) {
        if (folder) {
          const tgt = idx.get(key)!;
          const sub = tgt.files.get(folder) || [];
          if (filter) {
            all.push(sub.filter(el => filter!.test(el.module)));
          } else {
            all.push(sub);
          }
          if (folder === 'src' && tgt.index && (!filter || filter!.test(tgt.index.module))) {
            all.push([tgt.index]);
          }
        } else {
          for (const sub of idx.get(key)!.files.values()) {
            if (filter) {
              all.push(sub.filter(el => filter!.test(el.module)));
            } else {
              all.push(sub);
            }
          }
        }
      }
    }
    return all.flat();
  }

  /**
   * Find source files for a given set of rootPaths
   * @param appRoots List of all app root paths
   */
  static findAppSourceFiles(config: Pick<AppFindConfig, 'appRoots'> = {}) {
    const all: SimpleEntry[][] = [
      this.findFiles({ folder: 'src', appRoots: config.appRoots }),
    ];
    for (const folder of this.mainAppFolders) {
      if (folder !== 'src') {
        all.push(this.findFiles({ folder, rootPaths: config.appRoots || Env.appRoots }));
      }
    }
    return all.flat();
  }
}