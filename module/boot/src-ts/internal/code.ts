import { PathUtil } from '../path';
import { ScanEntry, ScanFs } from '../scan';
import { EnvUtil } from '../env';

type SimpleEntry = Pick<ScanEntry, 'module' | 'file'>;
type ScanTest = ((x: string) => boolean) | { test: (x: string) => boolean };
type FindConfig = { folder?: string, filter?: ScanTest, includeIndex?: boolean, paths?: string[] };
type FrameworkScan = { testDir: (x: string) => boolean, base: string, map: (e: ScanEntry) => ScanEntry };

/**
 * Configuration for searching for source files
 */
export interface SourceConfig {
  /**
   * Common folders, including all modules to search for source files in
   */
  common: string[];
  /**
   * Local folders (non-node_modules) to search for source files in
   */
  local: string[];
  /**
   * Which modules to exclude from searching
   */
  excludeModules: Set<string>;
}

type IndexRecord = { index?: SimpleEntry, base: string, files: Map<string, SimpleEntry[]> };

/**
 * Source code index
 */
export class SourceCodeIndex {

  private static _INDEX = new Map<string, IndexRecord>();

  /**
   * Compute index for a scan entry
   * @param entry
   */
  private static compute(entry: ScanEntry) {
    const file = entry.module;
    if (file.includes('node_modules')) {
      const mod = file.match(/^.*node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1];
      if (mod) { // External module
        if (entry.stats.isDirectory() || entry.stats.isSymbolicLink()) {
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
   * Scan the framework for folder/files only the framework should care about
   * @param testFile The test to determine if a file is desired
   */
  private static scanFramework(test: ScanTest) {
    const testFile = 'test' in test ? test.test.bind(test) : test;

    // Folders to check
    const folders = [
      {
        testDir: x =>
          /^node_modules[/]?$/.test(x) ||  // Top level node_modules
          (/^node_modules\/@travetto/.test(x) && !/node_modules.*node_modules/.test(x)) || // Module file
          !x.includes('node_modules'), // non module file
        base: PathUtil.cwd,
        map: e => e
      } as FrameworkScan,
      ...Object.entries(EnvUtil.getDynamicModules()).map(([dep, pth]) => (
        {
          testDir: x => !x.includes('node_modules'),
          base: pth,
          map: e => {
            e.module = e.module.includes('node_modules') ? e.module : e.file.replace(pth, `node_modules/${dep}`);
            return e;
          }
        } as FrameworkScan
      ))
    ];

    const out: ScanEntry[][] = [];
    for (const { testDir, base, map } of folders) {
      out.push(ScanFs.scanDirSync({ testFile, testDir }, base).map(map).filter(x => x.stats.isFile()));
    }
    return out.flat();
  }


  /**
   * Get index of all source files
   */
  private static get index() {
    if (this._INDEX.size === 0) {
      const idx = new Map<string, IndexRecord>();
      idx.set('.', { base: PathUtil.cwd, files: new Map() });

      for (const el of this.scanFramework(x => x.endsWith('.ts') && !x.endsWith('.d.ts'))) {
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
      this._INDEX = idx;
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
  static findByFolders(config: SourceConfig, mode: 'all' | 'required' = 'all') {
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