import * as fs from 'fs';

import * as path from '@travetto/path';

import type { Manifest, ManifestModuleFile, ManifestModuleFileType, ManifestModule } from './types';

type ScanTest = ((x: string) => boolean) | { test: (x: string) => boolean };
export type FindConfig = { folder?: string, filter?: ScanTest, includeIndex?: boolean };

export type ModuleIndexEntry = {
  id: string;
  source: string;
  module: string;
  file: string;
  fileTs: string;
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
  #outputToId = new Map<string, string>();

  constructor(root: string) {
    this.#root = root;
    this.#index();
  }

  #resolve(...parts: string[]): string {
    return path.resolve(this.#root, ...parts).replace(/[\\]/g, '/');
  }

  get manifest(): Manifest {
    return this.#manifest;
  }

  #moduleFiles(m: ManifestModule, files: ManifestModuleFile[]): ModuleIndexEntry[] {
    return files.map(([f, type]) => {
      const source = path.join(m.source, f);
      const fullFile = this.#resolve(m.output, f);
      const module = (m.output.startsWith('node_modules') ?
        `${m.output.split('node_modules/')[1]}/${f}` :
        `./${f}`).replace(/[.]ts$/, '.js');

      const id = m.root ? module : module.replace(m.name, m.id);

      return {
        id: id.replace(/\/src\//, '/').replace(/[.][tj]s$/, ''),
        type,
        source,
        fileTs: fullFile,
        file: fullFile.replace(/[.]ts$/, '.js'),
        module
      };
    });
  }

  /**
   * Get index of all source files
   */
  #index(): void {
    this.#manifest = JSON.parse(fs.readFileSync(this.#resolve('manifest.json'), 'utf8'));
    this.#modules = Object.values(this.manifest.modules).map(m => ({
      ...m,
      files: Object.fromEntries(
        Object.entries(m.files).map(([folder, files]) => [folder, this.#moduleFiles(m, files)])
      )
    }));

    for (const mod of this.#modules) {
      for (const [name, files] of Object.entries(mod.files ?? {})) {
        for (const { fileTs, id } of files) {
          this.#outputToId.set(fileTs, id);
        }
      }
    }
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

    const idx = this.#modules;
    const searchSpace = folder ?
      idx.flatMap(m => [...m.files[folder] ?? [], ...(config.includeIndex ? (m.files.index ?? []) : [])]) :
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
   * Get internal id from file name and optionally, class name
   */
  getId(filename: string, clsName?: string): string {
    filename = path.toPosix(filename);

    const id = this.#outputToId.get(filename) ?? filename;
    return clsName ? `${id}￮${clsName}` : id;
  }

  /**
   * Is module installed?
   */
  hasModule(name: string) {
    return name in this.manifest.modules;
  }

  /**
   * Resolve import
   */
  resolveImport(name: string): string {
    // TODO: Write own logic?
    return require.resolve(name);
  }
}

export const ModuleIndex = new $ModuleIndex(
  path.toPosix(process.env.TRV_CACHE ?? path.cwd())
);