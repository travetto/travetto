import { FsUtil } from './fs';
import { ScanEntry } from './scan';
import { FrameworkUtil, ScanTest } from './framework';

type SimpleEntry = Pick<ScanEntry, 'module' | 'file'>;

type FindConfig = { folder?: string, filter?: ScanTest, includeIndex?: boolean, paths?: string[] };

const isStandardFile = (x: string) => x.endsWith('.ts') && !x.endsWith('.d.ts');
const moduleMatcher = /^.*node_modules\/(@travetto\/[^/]+)(\/.*)?$/;

/**
 * Source index
 */
export class SourceIndex {

  private static _SOURCE_INDEX = new Map<string, { index?: SimpleEntry, base: string, files: Map<string, SimpleEntry[]> }>();

  /**
   * Compute index for a scan entry
   * @param entry
   */
  private static compute(entry: ScanEntry) {
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
   * Get index of all source files
   */
  private static get index() {
    if (this._SOURCE_INDEX.size === 0) {
      const idx = new Map() as (typeof SourceIndex)['_SOURCE_INDEX'];
      idx.set('.', { base: FsUtil.cwd, files: new Map() });

      for (const el of FrameworkUtil.scan(isStandardFile)) {
        const res = this.compute(el);

        if (!res) {
          continue;
        }

        const { mod, sub } = res;

        if (!idx.has(mod)) {
          idx.set(mod, { base: el.file, files: new Map() });
        }

        if (el.stats.isDirectory() || el.stats.isSymbolicLink()) {
          // Do nothing
        } else if (sub === 'index.ts') {
          idx.get(mod)!.index = el;
        } else {
          if (!idx.get(mod)!.files.has(sub)) {
            idx.get(mod)!.files.set(sub, []);
          }
          idx.get(mod)!.files.get(sub)!.push({ file: el.file, module: el.module });
        }
      }
      this._SOURCE_INDEX = idx;
    }
    return this._SOURCE_INDEX;
  }

  /**
   * Clears the app scanning cache
   */
  static reset() {
    this._SOURCE_INDEX.clear();
  }

  /**
   * Get paths from index
   */
  static getPaths() {
    return [...this.index.keys()];
  }

  /**
   * Find files from the index
   * @param paths The paths to check
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  static find(config: FindConfig) {
    const { filter: f, folder, paths = this.getPaths() } = config;
    const filter = f ? 'test' in f ? f.test.bind(f) : f : f;

    if (folder === 'src') {
      config.includeIndex = config.includeIndex ?? true;
    }
    const all: SimpleEntry[][] = [];
    const idx = this.index;
    for (const key of paths) {
      if (idx.has(key)) {
        const tgt = idx.get(key)!;
        if (folder) {
          const sub = tgt.files.get(folder) || [];
          if (filter) {
            all.push(sub.filter(el => filter(el.module)));
          } else {
            all.push(sub);
          }
        } else {
          for (const sub of tgt.files.values()) {
            if (filter) {
              all.push(sub.filter(el => filter(el.module)));
            } else {
              all.push(sub);
            }
          }
        }
        if (config.includeIndex && tgt.index && (!filter || filter(tgt.index.module))) {
          all.push([tgt.index]);
        }
      }
    }
    return all.flat();
  }

  /**
   * Find all source files registered
   * @param mode Should all sources files be returned, including optional.
   */
  static findByFolders(config: { common: string[], local: string[], excludeModules?: Set<string> }, mode: 'all' | 'required' = 'all') {
    const all: SimpleEntry[][] = [];
    const getAll = (src: string[], cmd: (c: FindConfig) => SimpleEntry[]) => {
      for (const folder of src.filter(x => mode === 'all' || !x.startsWith('^'))) {
        all.push(cmd({ folder: folder.replace('^', '') })
          .filter(x => mode === 'all' || !x.module.includes('.opt'))
        );
      }
    };
    getAll(config.common, c => this.find({
      ...c, paths: this.getPaths()
        .filter(x => !config.excludeModules || !config.excludeModules.has(x))
    }));
    getAll(config.local, c => this.find({ ...c, paths: ['.'] }));
    return all.flat();
  }
}