import { ScanEntry, FsUtil } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';
import { AppManifest } from './manifest';

type SimpleEntry = Pick<ScanEntry, 'module' | 'file'>;

type FindConfig =
  { folder?: string, filter?: Tester, paths: string[], includeIndex?: boolean } |
  { folder?: string, filter?: Tester, roots?: string[], includeIndex?: boolean };

type AppFindConfig = { folder?: string, filter?: Tester, roots?: string[] };

interface Tester {
  source: string;
  test(value: string): boolean;
}

/**
 * File scanning utilities, with a focus on application execution
 */
export class ScanApp {

  private static __INDEX = new Map<string, { index?: SimpleEntry, base: string, files: Map<string, SimpleEntry[]> }>();

  /**
   * List of primary app folders to search
   */
  static mainAppFolders = new Set(['src']);
  /**
   * List of modules to not traverse into
   */
  static modAppExclude = new Set(
    AppManifest.hasProfile('test') ?
      ['@travetto/cli', '@travetto/boot'] :
      ['@travetto/test', '@travetto/cli', '@travetto/boot']);

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
      const [, mod, sub] = file.match(/^(.*alt\/[^\/]+)\/?(?:([^/]+)(?:\/(.*)))?$/)!;
      if (entry.stats.isDirectory() || entry.stats.isSymbolicLink()) {
        return { mod: `./${mod}`, sub: '' };
      } else {
        return { mod: `./${mod}`, sub };
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
    if (this.__INDEX.size === 0) {
      this.__INDEX.set('.', { base: FsUtil.cwd, files: new Map() });

      for (const el of FrameworkUtil.scan(x => !x.endsWith('.d.ts') && x.endsWith('.ts'))) {
        const res = this.computeIndex(el);
        if (!res) {
          continue;
        }

        const { mod, sub } = res;

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
    this.__INDEX.clear();
  }

  /**
   * Find search keys
   * @param roots App paths
   */
  static getPaths(roots: string[]) {
    return [...this.index.keys()]
      .filter(key => (key.startsWith('@travetto') && !this.modAppExclude.has(key)) || roots.includes(key));
  }

  /**
   * Find all folders for the given root paths
   * @param paths The root paths to check
   * @param folder The folder to check into
   */
  static findFolders(config: FindConfig) {
    const all: string[] = [];
    const paths = 'paths' in config ? config.paths : this.getPaths(config.roots || AppManifest.roots);
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
   * @param paths The main application paths to check
   * @param folder The folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  static findFiles(config: FindConfig) {
    const { filter, folder } = config;
    if (folder === 'src') {
      config.includeIndex = config.includeIndex ?? true;
    }
    const paths = 'paths' in config ? config.paths : this.getPaths(config.roots || AppManifest.roots);
    const all: SimpleEntry[][] = [];
    const idx = this.index;
    for (const key of paths) {
      if (idx.has(key)) {
        const tgt = idx.get(key)!;
        if (folder) {
          const sub = tgt.files.get(folder) || [];
          if (filter) {
            all.push(sub.filter(el => filter!.test(el.module)));
          } else {
            all.push(sub);
          }
        } else {
          for (const sub of tgt.files.values()) {
            if (filter) {
              all.push(sub.filter(el => filter!.test(el.module)));
            } else {
              all.push(sub);
            }
          }
        }
        if (config.includeIndex && tgt.index && (!filter || filter!.test(tgt.index.module))) {
          all.push([tgt.index]);
        }
      }
    }
    return all.flat();
  }

  /**
   * Find source files for a given set of paths
   * @param roots List of all app root paths
   */
  static findAppSourceFiles(config: Pick<AppFindConfig, 'roots'> = {}) {
    const all: SimpleEntry[][] = [
      this.findFiles({ folder: 'src', roots: config.roots }),
    ];
    for (const folder of this.mainAppFolders) {
      if (folder !== 'src') {
        all.push(this.findFiles({ folder, paths: config.roots || AppManifest.roots }));
      }
    }
    return all.flat();
  }
}