import * as path from 'path';
import * as fs from 'fs';

import type { Manifest, ManifestModuleFile, ManifestModuleFileType, ManifestModule } from './types';

type ScanTest = ((x: string) => boolean) | { test: (x: string) => boolean };
export type FindConfig = { folder?: string, filter?: ScanTest, includeIndex?: boolean };

export type ModuleIndexEntry = {
  source: string;
  module: string;
  file: string;
  type: ManifestModuleFileType;
};

type IndexedModule = {
  id: string;
  name: string;
  source: string;
  output: string;
  files: Record<string, ModuleIndexEntry[]>;
};

/**
 * Module index, files to be loaded at runtime
 */
class $ModuleIndex {

  #manifest: Manifest;
  #modules: IndexedModule[];
  #root: string;
  #idCache = new Map<string, string>();

  constructor(root: string) {
    this.#root = root;
  }

  #resolve(...parts: string[]): string {
    return path.resolve(this.#root, ...parts).replace(/[\\]/g, '/');
  }

  get manifest(): Manifest {
    this.#manifest ??= JSON.parse(fs.readFileSync(this.#resolve('manifest.json'), 'utf8'));
    return this.#manifest;
  }

  #moduleFiles(m: ManifestModule, files: ManifestModuleFile[]): ModuleIndexEntry[] {
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
    return this.#modules ??= Object.values(this.manifest.modules).map(m => ({
      ...m,
      files: Object.fromEntries(
        Object.entries(m.files).map(([folder, files]) => [folder, this.#moduleFiles(m, files)])
      )
    }));
  }

  get modules(): IndexedModule[] {
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


  /**
   * Compute internal id from file name and optionally, class name
   */
  computeId(filename: string, clsName?: string): string {
    if (clsName) {
      return `${this.computeId(filename)}￮${clsName}`;
    }

    filename = filename.__posix;

    if (this.#idCache.has(filename)) {
      return this.#idCache.get(filename)!;
    }

    const rel = filename.replace(`${process.cwd().__posix}/`, '');

    const mod = rel.startsWith('node_modules') ?
      this.#modules.find(x => rel.startsWith(`${x.output}/`)) :
      this.#modules.find(x => x.output === '');

    if (mod) {
      const name = rel.replace(mod.output, mod.id).replace(/\/src\//, '/');
      this.#idCache.set(filename, name);
      return name;
    } else {
      this.#idCache.set(filename, filename);
      return filename;
    }
  }
}

export const ModuleIndex = new $ModuleIndex(
  (process.env.TRV_CACHE ?? process.cwd()).__posix
);