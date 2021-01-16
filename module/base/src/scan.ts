import { ScanEntry, FsUtil } from '@travetto/boot';
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
export class ScanApp {

  private static _INDEX = new Map<string, { index?: SimpleEntry, base: string, files: Map<string, SimpleEntry[]> }>();

  /**
   * Compute index for a scan entry
   * @param entry
   */
  static computeIndex(entry: ScanEntry, moduleMatcher: RegExp) {
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
  static get index() {
    if (this._INDEX.size === 0) {
      this._INDEX.set('.', { base: FsUtil.cwd, files: new Map() });

      for (const el of FrameworkUtil.scan(x => x.endsWith('.ts') && !x.endsWith('.d.ts'))) {
        const res = this.computeIndex(el, /^.*node_modules\/(@travetto\/[^/]+)(\/.*)?$/);

        if (!res) {
          continue;
        }

        const { mod, sub } = res;

        if (!this._INDEX.has(mod)) {
          this._INDEX.set(mod, { base: el.file, files: new Map() });
        }

        if (el.stats.isDirectory() || el.stats.isSymbolicLink()) {
          // Do nothing
        } else if (sub === 'index.ts') {
          this._INDEX.get(mod)!.index = el;
        } else {
          if (!this._INDEX.get(mod)!.files.has(sub)) {
            this._INDEX.get(mod)!.files.set(sub, []);
          }
          this._INDEX.get(mod)!.files.get(sub)!.push({ file: el.file, module: el.module });
        }
      }
    }
    return this._INDEX;
  }

  /**
   * Clears the app scanning cache
   */
  static reset() {
    this._INDEX.clear();
  }

  /**
   * Find search keys
   * @param roots App paths
   */
  static getPaths() {
    return [...this.index.keys()].filter(key => !AppManifest.commonSourceExcludeModules.has(key));
  }

  /**
   * Find files from the index
   * @param paths The paths to check
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  static findFiles(config: FindConfig) {
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
  static findCommonFiles(config: Omit<FindConfig, 'paths'>) {
    return this.findFiles({ ...config, paths: this.getPaths() });
  }

  /**
   * Find local files
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  static findLocalFiles(config: Omit<FindConfig, 'paths'>) {
    return this.findFiles({ ...config, paths: ['.'] });
  }

  /**
   * Find source files for a given set of paths
   */
  static findSourceFiles(this: typeof ScanApp, mode: 'all' | 'required' = 'all') {
    const all: SimpleEntry[][] = [];
    const getAll = (src: string[], cmd: (typeof this)['findCommonFiles' | 'findLocalFiles']) => {
      for (const folder of src.filter(x => mode === 'all' || !x.startsWith('^'))) {
        all.push(cmd.call(this, { folder: folder.replace('^', '') })
          .filter(x => mode === 'all' || !x.module.includes('.opt'))
        );
      }
    };
    getAll(AppManifest.commonSourceFolders, this.findCommonFiles);
    getAll(AppManifest.localSourceFolders, this.findLocalFiles);
    return all.flat();
  }
}