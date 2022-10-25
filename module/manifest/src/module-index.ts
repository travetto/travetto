import * as path from 'path';
import type { ManifestShape, ModuleFile, ModuleFileType, ModuleShape } from './types';


type ScanTest = ((x: string) => boolean) | { test: (x: string) => boolean };
export type FindConfig = { folder?: string, filter?: ScanTest, includeIndex?: boolean };

export type ModuleIndexEntry = {
  source: string;
  module: string;
  file: string;
  type: ModuleFileType;
};

type IndexedModule = {
  name: string;
  source: string;
  output: string;
  files: Record<string, ModuleIndexEntry[]>;
};

const CWD = process.cwd().replace(/[\\]/g, '/');

/**
 * Module index, files to be loaded at runtime
 */
class $ModuleIndex {

  #modules: IndexedModule[];
  #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  #resolve(...parts: string[]): string {
    return path.resolve(this.#root, ...parts).replace(/[\\]/g, '/');
  }

  #loadManifest(): ManifestShape {
    const modules: ManifestShape = require(this.#resolve('manifest.json'));
    return modules;
  }

  #moduleFiles(m: ModuleShape, files: ModuleFile[]): ModuleIndexEntry[] {
    return files.map(([f, type]) => {
      const source = path.join(m.source, f);
      const fullFile = this.#resolve(m.output, f).replace(/[.]ts$/, '.js');
      const module = (m.output.startsWith('node_modules') ?
        `${m.output.split('node_modules/')[1]}/${f}` :
        `./${f}`).replace(/[.]ts$/, '.js');
      return {
        type,
        source,
        file: fullFile,
        module
      };
    });
  }

  /**
   * Get index of all source files
   */
  get #index(): IndexedModule[] {
    return this.#modules ??= Object.values(this.#loadManifest().modules).map(m => ({
      ...m,
      files: Object.fromEntries(
        Object.entries(m.files).map(([folder, files]) => [folder, this.#moduleFiles(m, files)])
      )
    }));
  }

  get modules() {
    return this.#modules;
  }

  /**
   * Clears the app scanning cache
   */
  reset(): void {
    // @ts-expect-error
    this.#modules = undefined;
  }

  /**
   * Find files from the index
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  find(config: FindConfig): ModuleIndexEntry[] {
    const { filter: f, folder } = config;
    const filter = f ? 'test' in f ? f.test.bind(f) : f : f;

    const idx = this.#index;
    const searchSpace = folder ?
      idx.flatMap(m => [...m.files[folder] ?? [], ...(config.includeIndex ? m.files.index : [])]) :
      idx.flatMap(m => [...Object.values(m.files)].flat());

    return searchSpace
      .filter(({ type }) => type === 'ts')
      .filter(({ file }) => filter?.(file) ?? true);
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findSupport(config: Omit<FindConfig, 'folder'>): ModuleIndexEntry[] {
    return this.find({ ...config, folder: 'support' });
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findSrc(config: Omit<FindConfig, 'folder'>): ModuleIndexEntry[] {
    return this.find({ ...config, folder: 'src', includeIndex: true });
  }

  findOwnSrc(): ModuleIndexEntry[] {
    return this.findSrc({
      filter: x => !x.includes('node_modules') && x.includes('src/')
    });
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findTest(config: Omit<FindConfig, 'folder'>): ModuleIndexEntry[] {
    return this.find({ ...config, folder: 'test' });
  }
}

export const ModuleIndex = new $ModuleIndex(
  (process.env.TRV_CACHE ?? process.cwd()).replace(/[\\]/g, '/')
);