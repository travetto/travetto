import { existsSync } from 'node:fs';

import { ManifestModuleUtil } from './module';
import { path } from './path';
import { ManifestUtil } from './util';

import type { ManifestModuleFolderType } from './types/common';
import type { ManifestModule, ManifestRoot, ManifestModuleFile, IndexedModule, IndexedFile, FindConfig } from './types/manifest';

const TypedObject: {
  keys<T = unknown, K extends keyof T = keyof T>(o: T): K[];
  fromEntries<K extends string | symbol, V>(items: ([K, V] | readonly [K, V])[]): Record<K, V>;
  entries<K extends Record<symbol | string, unknown>>(record: K): [keyof K, K[keyof K]][];
} & ObjectConstructor = Object;

/**
 * Manifest index
 */
export class ManifestIndex {

  #arbitraryLookup?: (parts: string[]) => ManifestModule | undefined;
  #manifest: ManifestRoot;
  #modules: IndexedModule[];
  #modulesByName: Record<string, IndexedModule> = {};
  #modulesByFolder: Record<string, IndexedModule> = {};
  #outputRoot: string;
  #outputToEntry = new Map<string, IndexedFile>();
  #sourceToEntry = new Map<string, IndexedFile>();
  #importToEntry = new Map<string, IndexedFile>();

  constructor(manifest: string = process.env.TRV_MANIFEST!) {
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

  init(manifestInput: string): void {
    this.#manifest = ManifestUtil.readManifestSync(manifestInput);
    this.#outputRoot = path.resolve(this.#manifest.workspace.path, this.#manifest.build.outputFolder);
    this.#index();
  }

  /**
   * **WARNING**: This is a destructive operation, and should only be called before loading any code
   * @private
   */
  reinitForModule(module: string): void {
    this.init(`${this.outputRoot}/node_modules/${module}`);
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
    this.#arbitraryLookup = undefined;

    this.#modules = Object.values(this.#manifest.modules)
      .map(m => ({
        ...m,
        outputPath: this.#resolveOutput(m.outputFolder),
        sourcePath: path.resolve(this.#manifest.workspace.path, m.sourceFolder),
        children: new Set(),
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

    // Store child information
    for (const mod of this.#modules) {
      for (const p of mod.parents) {
        this.#modulesByName[p]?.children.add(mod.name);
      }
    }
  }

  /**
   * Get internal id from file name and optionally, class name
   */
  getId(filename: string, clsName?: string): string {
    filename = path.toPosix(filename);
    const id = this.getEntry(filename)?.id ?? filename;
    return clsName ? `${id}￮${clsName}` : id;
  }

  /**
   * Get entry by file (input or output)
   */
  getEntry(file: string): IndexedFile | undefined {
    return this.#outputToEntry.get(file) ?? this.#sourceToEntry.get(file);
  }

  /**
   * Get all workspace modules
   * @returns
   */
  getWorkspaceModules(): IndexedModule[] {
    return this.#modules.filter(x => x.workspace);
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
  getModuleList(mode: 'workspace' | 'all', exprList: string = ''): Set<string> {
    const allMods = Object.keys(this.#manifest.modules);
    const active = new Set<string>(mode === 'workspace' ? this.getWorkspaceModules().map(x => x.name) : allMods);

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
   * Get all modules, parents or children, (transitively) of the provided root, in a DFS fashion
   */
  getDependentModules(root: IndexedModule | string, field: 'parents' | 'children'): IndexedModule[] {
    const seen = new Set<string>();
    const out: IndexedModule[] = [];
    const toProcess = [typeof root === 'string' ? root : root.name];
    while (toProcess.length) {
      const next = toProcess.shift()!;
      if (!seen.has(next)) {
        seen.add(next);
        const mod = this.getModule(next)!;
        toProcess.push(...mod[field]);
        if (next !== this.#manifest.main.name) { // Do not include self
          out.push(mod);
        }
      }
    }
    return out;
  }

  /**
   * Find the module for an arbitrary source file, if it falls under a given workspace module
   */
  findModuleForArbitraryFile(file: string): ManifestModule | undefined {
    const base = this.#manifest.workspace.path;
    const lookup = this.#arbitraryLookup ??= ManifestUtil.lookupTrie(
      Object.values(this.#manifest.modules),
      x => x.sourceFolder.split('/'),
      sub =>
        !existsSync(path.resolve(base, ...sub, 'package.json')) &&
        !existsSync(path.resolve(base, ...sub, '.git'))
    );
    return lookup(file.replace(`${base}/`, '').split('/'));
  }

  /**
   * Get manifest module by name
   */
  getManifestModule(mod: string): ManifestModule {
    return this.manifest.modules[mod];
  }

  /**
   * Get manifest modules
   */
  getManifestModules(): ManifestModule[] {
    return Object.values(this.manifest.modules);
  }

  /**
   * Get main module for manifest
   */
  get mainModule(): IndexedModule {
    return this.getModule(this.manifest.main.name)!;
  }

  /**
   * Get source file from import location
   * @param outputFile
   */
  getSourceFile(importFile: string): string {
    return this.getFromImport(importFile)?.sourceFile ?? importFile;
  }
}

export const RuntimeIndex = new ManifestIndex();