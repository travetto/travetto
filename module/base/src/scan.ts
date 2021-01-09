import { ScanEntry, FsUtil, EnvUtil } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';
import { AppManifest } from './manifest';

type SimpleEntry = Pick<ScanEntry, 'module' | 'file'>;

type FindConfig = { folder?: string, filter?: Tester, paths: string[], includeIndex?: boolean };

interface Tester {
  source: string;
  test(value: string): boolean;
}

/**
 * File scanning utilities, with a focus on application execution
 */
class $ScanApp {

  private _index = new Map<string, { index?: SimpleEntry, base: string, files: Map<string, SimpleEntry[]> }>();

  /**
   * List of modules to not traverse into
   */
  modSourceExclude = new Set([
    // This drives the init process, so cannot happen in a support file
    ...EnvUtil.getList('TRV_SRC_COMMON_EXCLUDE'),
    '@travetto/cli', '@travetto/boot', '@travetto/doc'
  ]);

  /**
   * Compute index for a scan entry
   * @param entry
   */
  computeIndex(entry: ScanEntry, moduleMatcher: RegExp) {
    const file = entry.module;
    if (file.includes('node_modules')) {
      if (moduleMatcher.test(file)) { // External module
        const mod = file.replace(moduleMatcher, (a, b) => b);
        if (mod.includes('node_modules')) {
          return;
        } else if (entry.stats.isDirectory() || entry.stats.isSymbolicLink()) {
          return { mod, sub: '' };
        } else {
          const [sub] = file.split(`${mod}/`)[1].split('/');
          return { mod, sub };
        }
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
  get index() {
    if (this._index.size === 0) {
      this._index.set('.', { base: FsUtil.cwd, files: new Map() });

      for (const el of FrameworkUtil.scan(x => x.endsWith('.ts') && !x.endsWith('.d.ts'))) {
        const res = this.computeIndex(el, /^.*node_modules\/(@travetto\/[^/]+)(\/.*)?$/);

        if (!res) {
          continue;
        }

        const { mod, sub } = res;

        if (!this._index.has(mod)) {
          this._index.set(mod, { base: el.file, files: new Map() });
        }

        if (el.stats.isDirectory() || el.stats.isSymbolicLink()) {
          // Do nothing
        } else if (sub === 'index.ts') {
          this._index.get(mod)!.index = el;
        } else {
          if (!this._index.get(mod)!.files.has(sub)) {
            this._index.get(mod)!.files.set(sub, []);
          }
          this._index.get(mod)!.files.get(sub)!.push({ file: el.file, module: el.module });
        }
      }
    }
    return this._index;
  }

  /**
   * Clears the app scanning cache
   */
  reset() {
    this._index.clear();
  }

  /**
   * Find search keys
   * @param roots App paths
   */
  getPaths() {
    return [...this.index.keys()].filter(key => !this.modSourceExclude.has(key));
  }

  /**
   * Find files from the index
   * @param paths The paths to check
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  findFiles(config: FindConfig) {
    const { filter, folder } = config;
    if (folder === 'src') {
      config.includeIndex = config.includeIndex ?? true;
    }
    const all: SimpleEntry[][] = [];
    const idx = this.index;
    for (const key of config.paths) {
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
   * Find shared files
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  findCommonFiles(config: Omit<FindConfig, 'paths'>) {
    return this.findFiles({ ...config, paths: this.getPaths() });
  }

  /**
   * Find local files
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  findLocalFiles(config: Omit<FindConfig, 'paths'>) {
    return this.findFiles({ ...config, paths: ['.'] });
  }

  /**
   * Find source files for a given set of paths
   */
  findAllSourceFiles() {
    const all: SimpleEntry[][] = [];
    for (const folder of AppManifest.commonSourceFolders) {
      all.push(this.findCommonFiles({ folder }));
    }
    for (const folder of AppManifest.localSourceFolders) {
      all.push(this.findLocalFiles({ folder }));
    }
    return all.flat();
  }
}

export const ScanApp = new $ScanApp();