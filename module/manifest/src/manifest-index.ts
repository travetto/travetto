import { ManifestModuleUtil } from './module';
import { path } from './path';

import {
  ManifestModule, ManifestModuleCore, ManifestModuleFile,
  ManifestModuleFileType, ManifestModuleFolderType, ManifestModuleRole, ManifestRoot
} from './types';

import { ManifestUtil } from './util';

export type FindConfig = {
  folder?: (folder: ManifestModuleFolderType) => boolean;
  module?: (module: IndexedModule) => boolean;
  file?: (file: IndexedFile) => boolean;
  sourceOnly?: boolean;
};

export type IndexedFile = {
  id: string;
  import: string;
  module: string;
  sourceFile: string;
  outputFile: string;
  relativeFile: string;
  role: ManifestModuleRole;
  type: ManifestModuleFileType;
};

export type IndexedModule = ManifestModuleCore & {
  sourcePath: string;
  outputPath: string;
  files: Record<ManifestModuleFolderType, IndexedFile[]>;
};

const TypedObject: {
  keys<T = unknown, K extends keyof T = keyof T>(o: T): K[];
  fromEntries<K extends string | symbol, V>(items: ([K, V] | readonly [K, V])[]): Record<K, V>;
  entries<K extends Record<symbol | string, unknown>>(record: K): [keyof K, K[keyof K]][];
} & ObjectConstructor = Object;

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
    this.#outputRoot = path.resolve(this.#manifest.workspace.path, this.#manifest.build.outputFolder);
    this.#index();
  }

  #moduleFiles(m: ManifestModule, files: ManifestModuleFile[]): IndexedFile[] {
    return files.map(([f, type, ts, role = 'std']) => {
      const isSource = type === 'ts' || type === 'js';
      const sourceFile = path.resolve(this.#manifest.workspace.path, m.sourceFolder, f);
      const js = isSource ? ManifestModuleUtil.sourceToOutputExt(f) : f;
      const outputFile = this.#resolveOutput(m.outputFolder, js);
      const modImport = `${m.name}/${js}`;
      let id = modImport.replace(`${m.name}/`, _ => _.replace(/[/]$/, ':'));
      if (isSource) {
        id = ManifestModuleUtil.sourceToBlankExt(id);
      }

      return { id, type, sourceFile, outputFile, import: modImport, role, relativeFile: f, module: m.name };
    });
  }

  /**
   * Get index of all source files
   */
  #index(): void {
    this.#outputToEntry.clear();
    this.#importToEntry.clear();
    this.#sourceToEntry.clear();

    this.#modules = Object.values(this.#manifest.modules)
      .map(m => ({
        ...m,
        outputPath: this.#resolveOutput(m.outputFolder),
        sourcePath: path.resolve(this.#manifest.workspace.path, m.sourceFolder),
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
   * @param config The configuration for controlling the find process
   */
  find(config: FindConfig): IndexedFile[] {
    const searchSpace: IndexedFile[] = [];
    for (const m of this.#modules) {
      if (config.module?.(m) ?? true) {
        for (const [folder, files] of TypedObject.entries(m.files)) {
          if (config.folder?.(folder) ?? true) {
            for (const file of files) {
              if (
                (config.file?.(file) ?? true) &&
                (config.sourceOnly === false || file.type === 'ts')
              ) {
                searchSpace.push(file);
              }
            }
          }
        }
      }
    }
    return searchSpace;
  }

  /**
   * Is module installed?
   */
  hasModule(name: string): boolean {
    return name in this.#manifest.modules;
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
    return this.getFromImport(name)?.outputFile ?? name;
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
    // Strip ext
    imp = ManifestModuleUtil.sourceToBlankExt(imp);
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
   * Build module list from an expression list (e.g. `@travetto/rest,-@travetto/log)
   */
  getModuleList(mode: 'local' | 'all', exprList: string = ''): Set<string> {
    const allMods = Object.keys(this.#manifest.modules);
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