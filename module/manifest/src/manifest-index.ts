import { path } from './path';

import {
  ManifestModule, ManifestModuleCore, ManifestModuleFile,
  ManifestModuleFileType, ManifestModuleFolderType, ManifestProfile, ManifestRoot
} from './types';

import { ManifestUtil } from './util';

type ScanTest = ((full: string) => boolean) | { test: (full: string) => boolean };
export type FindConfig = {
  folders?: ManifestModuleFolderType[];
  filter?: ScanTest;
  includeIndex?: boolean;
  profiles?: string[];
  checkProfile?: boolean;
};

export type IndexedFile = {
  id: string;
  import: string;
  module: string;
  sourceFile: string;
  outputFile: string;
  relativeFile: string;
  profile: ManifestProfile;
  type: ManifestModuleFileType;
};

export type IndexedModule = ManifestModuleCore & {
  sourcePath: string;
  outputPath: string;
  files: Record<ManifestModuleFolderType, IndexedFile[]>;
};

/**
 * Manifest index
 */
export class ManifestIndex {

  #manifestFile: string;
  #manifest: ManifestRoot;
  #modules: IndexedModule[];
  #modulesByName: Record<string, IndexedModule> = {};
  #modulesByFolder: Record<string, IndexedModule> = {};
  #outputRoot: string;
  #outputToEntry = new Map<string, IndexedFile>();
  #sourceToEntry = new Map<string, IndexedFile>();
  #importToEntry = new Map<string, IndexedFile>();

  constructor(manifest: string) {
    this.init(manifest);
  }

  #resolveOutput(...parts: string[]): string {
    return path.resolve(this.#outputRoot, ...parts);
  }

  get manifest(): ManifestRoot {
    return this.#manifest;
  }

  get outputRoot(): string {
    return this.#outputRoot;
  }

  get manifestFile(): string {
    return this.#manifestFile;
  }

  init(manifestInput: string): void {
    const { manifest, file } = ManifestUtil.readManifestSync(manifestInput);
    this.#manifest = manifest;
    this.#manifestFile = file;
    this.#outputRoot = path.resolve(this.#manifest.workspacePath, this.#manifest.outputFolder);
    this.#index();
  }

  #moduleFiles(m: ManifestModule, files: ManifestModuleFile[]): IndexedFile[] {
    return files.map(([f, type, ts, profile = 'std']) => {
      const sourceFile = path.resolve(this.#manifest.workspacePath, m.sourceFolder, f);
      const js = (type === 'ts' ? f.replace(/[.]ts$/, '.js') : f);
      const outputFile = this.#resolveOutput(m.outputFolder, js);
      const modImport = `${m.name}/${js}`;
      let id = modImport.replace(`${m.name}/`, _ => _.replace(/[/]$/, ':'));
      if (type === 'ts' || type === 'js') {
        id = id.replace(/[.]js$/, '');
      }

      return { id, type, sourceFile, outputFile, import: modImport, profile, relativeFile: f, module: m.name };
    });
  }

  /**
   * Get index of all source files
   */
  #index(): void {
    this.#outputToEntry.clear();
    this.#importToEntry.clear();
    this.#sourceToEntry.clear();

    this.#modules = Object.values(this.manifest.modules)
      .map(m => ({
        ...m,
        outputPath: this.#resolveOutput(m.outputFolder),
        sourcePath: path.resolve(this.manifest.workspacePath, m.sourceFolder),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        files: Object.fromEntries(
          Object.entries(m.files).map(([folder, files]) => [folder, this.#moduleFiles(m, files ?? [])])
        ) as Record<ManifestModuleFolderType, IndexedFile[]>
      }));

    for (const mod of this.#modules) {
      for (const files of Object.values(mod.files ?? {})) {
        for (const entry of files) {
          this.#outputToEntry.set(entry.outputFile, entry);
          this.#sourceToEntry.set(entry.sourceFile, entry);
          this.#importToEntry.set(entry.import, entry);
          this.#importToEntry.set(entry.import.replace(/[.]js$/, ''), entry);
          this.#importToEntry.set(entry.import.replace(/[.]js$/, '.ts'), entry);
        }
      }
    }
    this.#modulesByName = Object.fromEntries(this.#modules.map(x => [x.name, x]));
    this.#modulesByFolder = Object.fromEntries(this.#modules.map(x => [x.sourceFolder, x]));
  }

  /**
   * Get entry by file (input or output)
   */
  getEntry(file: string): IndexedFile | undefined {
    return this.#outputToEntry.get(file) ?? this.#sourceToEntry.get(file);
  }

  /**
   * Get all local modules
   * @returns
   */
  getLocalModules(): IndexedModule[] {
    return this.#modules.filter(x => x.local);
  }

  /**
   * Find files from the index
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  find(config: FindConfig): IndexedFile[] {
    const { filter: f, folders } = config;
    const filter = f ? 'test' in f ? f.test.bind(f) : f : f;

    let idx = this.#modules;

    const checkProfile = config.checkProfile ?? true;

    const activeProfiles = new Set(['std', ...(config.profiles ?? process.env.TRV_PROFILES?.split(/\s*,\s*/g) ?? [])]);

    if (checkProfile) {
      idx = idx.filter(m => m.profiles.length === 0 || m.profiles.some(p => activeProfiles.has(p)));
    }

    let searchSpace = folders ?
      idx.flatMap(m => [...folders.flatMap(fo => m.files[fo] ?? []), ...(config.includeIndex ? (m.files.$index ?? []) : [])]) :
      idx.flatMap(m => [...Object.values(m.files)].flat());

    if (checkProfile) {
      searchSpace = searchSpace.filter(fi => activeProfiles.has(fi.profile));
    }

    return searchSpace
      .filter(({ type }) => type === 'ts')
      .filter(({ sourceFile: source }) => filter?.(source) ?? true);
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findSupport(config: Omit<FindConfig, 'folder'>): IndexedFile[] {
    return this.find({ ...config, folders: ['support'] });
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findSrc(config: Omit<FindConfig, 'folder'> = {}): IndexedFile[] {
    return this.find({ ...config, includeIndex: true, folders: ['src'] });
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findTest(config: Omit<FindConfig, 'folder'>): IndexedFile[] {
    return this.find({ ...config, folders: ['test'] });
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
    return this.#modulesByName[name];
  }

  /**
   * Get module by folder
   */
  getModuleByFolder(folder: string): IndexedModule | undefined {
    return this.#modulesByFolder[folder];
  }

  /**
   * Resolve import
   */
  resolveFileImport(name: string): string {
    return this.#importToEntry.get(name)?.outputFile ?? name;
  }

  /**
   * Get indexed module from source file
   * @param source
   */
  getFromSource(source: string): IndexedFile | undefined {
    return this.#sourceToEntry.get(source);
  }

  /**
   * Get indexed module from source file
   * @param source
   */
  getFromImport(imp: string): IndexedFile | undefined {
    return this.#importToEntry.get(imp);
  }

  /**
   * Get module from source file
   * @param source
   */
  getModuleFromSource(source: string): IndexedModule | undefined {
    const name = this.getFromSource(source)?.module;
    return name ? this.getModule(name) : undefined;
  }

  /**
   * Get module from import name
   * @param importName
   */
  getModuleFromImport(importName: string): IndexedModule | undefined {
    const name = this.getFromImport(importName)?.module;
    return name ? this.getModule(name) : undefined;
  }
  /**
   * Build module list from an expression list (e.g. `@travetto/app,-@travetto/log)
   */
  getModuleList(mode: 'local' | 'all', exprList: string = ''): Set<string> {
    const allMods = Object.keys(this.manifest.modules);
    const active = new Set<string>(
      mode === 'local' ? this.getLocalModules().map(x => x.name) :
        (mode === 'all' ? allMods : [])
    );

    for (const expr of exprList.split(/\s*,\s*/g)) {
      const [, neg, mod] = expr.match(/(-|[+])?([^+\- ]+)$/) ?? [];
      if (mod) {
        const patt = new RegExp(`^${mod.replace(/[*]/g, '.*')}$`);
        for (const m of allMods.filter(x => patt.test(x))) {
          active[neg ? 'delete' : 'add'](m);
        }
      }
    }
    return active;
  }

  /**
   * Get all modules (transitively) that depend on this module
   */
  getDependentModules(root: IndexedModule): Set<IndexedModule> {
    const seen = new Set<string>();
    const out = new Set<IndexedModule>();
    const toProcess = [root.name];
    while (toProcess.length) {
      const next = toProcess.shift()!;
      if (seen.has(next)) {
        continue;
      }
      const mod = this.getModule(next)!;
      toProcess.push(...mod.parents);
      out.add(mod);
    }
    return out;
  }
}