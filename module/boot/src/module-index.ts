import * as fs from 'fs';

import { path, Manifest } from '@travetto/common';

type ScanTest = ((x: string) => boolean) | { test: (x: string) => boolean };
export type FindConfig = {
  folder?: string;
  filter?: ScanTest;
  includeIndex?: boolean;
  profiles?: string[];
  checkProfile?: boolean;
};

export type IndexedFile = {
  id: string;
  module: string;
  source: string;
  output: string;
  type: Manifest.ModuleFileType;
};

export type IndexedModule = {
  id: string;
  name: string;
  profiles: string[];
  source: string;
  output: string;
  main?: boolean;
  files: Record<string, IndexedFile[]>;
};

/**
 * Module index, files to be loaded at runtime
 */
class $ModuleIndex {

  #manifest: Manifest.Root;
  #modules: IndexedModule[];
  #root: string;
  #outputToEntry = new Map<string, IndexedFile>();
  #sourceToEntry = new Map<string, IndexedFile>();

  constructor(root: string) {
    this.#root = root;
    this.#index();
  }

  #resolve(...parts: string[]): string {
    return path.resolve(this.#root, ...parts).replace(/[\\]/g, '/');
  }

  get manifest(): Manifest.Root {
    return this.#manifest;
  }

  #moduleFiles(m: Manifest.Module, files: Manifest.ModuleFile[]): IndexedFile[] {
    return files.map(([f, type]) => {
      const source = path.join(m.source, f);
      const js = (type === 'ts' ? f.replace(/[.]ts$/, '.js') : f);
      const output = this.#resolve(m.output, js);
      const module = `${m.name}/${js}`;
      const id = (m.main ? module : module.replace(m.name, m.id)).replace(/[.]js$/, '');

      return { id, type, source, output, module };
    });
  }

  /**
   * Get index of all source files
   */
  #index(): void {
    this.#manifest = JSON.parse(fs.readFileSync(this.#resolve('manifest.json'), 'utf8'));
    this.#modules = Object.values(this.manifest.modules).map(m => ({
      ...m,
      output: this.#resolve(m.output),
      files: Object.fromEntries(
        Object.entries(m.files).map(([folder, files]) => [folder, this.#moduleFiles(m, files)])
      )
    }));

    for (const mod of this.#modules) {
      for (const files of Object.values(mod.files ?? {})) {
        for (const entry of files) {
          this.#outputToEntry.set(entry.output, entry);
          this.#sourceToEntry.set(entry.source, entry);
        }
      }
    }
  }

  #getEntry(file: string): IndexedFile | undefined {
    return this.#outputToEntry.get(file);
  }

  /**
   * Find files from the index
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  find(config: FindConfig): IndexedFile[] {
    const { filter: f, folder } = config;
    const filter = f ? 'test' in f ? f.test.bind(f) : f : f;

    let idx = this.#modules;

    if (config.checkProfile ?? true) {
      const activeProfiles = new Set(config.profiles ?? process.env.TRV_PROFILES?.split(/\s*,\s*/g) ?? []);
      idx = idx.filter(m => m.profiles.length === 0 || m.profiles.some(p => activeProfiles.has(p)));
    }

    const searchSpace = folder ?
      idx.flatMap(m => [...m.files[folder] ?? [], ...(config.includeIndex ? (m.files.index ?? []) : [])]) :
      idx.flatMap(m => [...Object.values(m.files)].flat());

    return searchSpace
      .filter(({ type }) => type === 'ts')
      .filter(({ source }) => filter?.(source) ?? true);
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findSupport(config: Omit<FindConfig, 'folder'>): IndexedFile[] {
    return this.find({ ...config, folder: 'support' });
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findSrc(config: Omit<FindConfig, 'folder'>): IndexedFile[] {
    return this.find({ ...config, folder: 'src', includeIndex: true });
  }

  findOwnSrc(): IndexedFile[] {
    return this.findSrc({
      filter: x => !x.includes('node_modules') && x.includes('src/')
    });
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findTest(config: Omit<FindConfig, 'folder'>): IndexedFile[] {
    return this.find({ ...config, folder: 'test' });
  }

  /**
   * Get internal id from file name and optionally, class name
   */
  getId(filename: string, clsName?: string): string {
    filename = path.toPosix(filename);
    const id = this.#getEntry(filename)?.id ?? filename;
    return clsName ? `${id}￮${clsName}` : id;
  }

  /**
   * Is module installed?
   */
  hasModule(name: string): boolean {
    return name in this.manifest.modules;
  }

  /**
   * Get module
   */
  getModule(name: string): IndexedModule | undefined {
    return this.#modules.find(x => x.name === name);
  }

  /**
   * Resolve import
   */
  resolveImport(name: string): string {
    // TODO: Write own logic?
    return require.resolve(name);
  }

  /**
   * Get source file from output location
   * @param outputFile
   */
  getSourceFile(outputFile: string): string {
    return this.#outputToEntry.get(outputFile)?.source ?? outputFile;
  }

  /**
   * Get node module from source file
   * @param source
   */
  getModuleFromSource(source: string): string | undefined {
    return this.#sourceToEntry.get(source)?.module;
  }
}

export const ModuleIndex = new $ModuleIndex(
  path.toPosix(process.env.TRV_OUTPUT ?? path.cwd())
);