import { existsSync } from 'node:fs';

import { ManifestModuleUtil } from './module.ts';
import path from './path.ts';
import { ManifestUtil } from './util.ts';

import type { ManifestModule, ManifestRoot, ManifestModuleFile, IndexedModule, IndexedFile, FindConfig } from './types/manifest.ts';

const TypedObject: {
  keys<T = unknown, K extends keyof T = keyof T>(item: T): K[];
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
  #outputRoot: string;
  #outputToEntry = new Map<string, IndexedFile>();
  #sourceToEntry = new Map<string, IndexedFile>();
  #importToEntry = new Map<string, IndexedFile>();

  constructor(manifest: string | ManifestRoot = process.env.TRV_MANIFEST!) {
    this.init(manifest || path.resolve(import.meta.dirname, './manifest.json'));
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

  init(manifestInput: string | ManifestRoot): void {
    this.#manifest = typeof manifestInput === 'string' ? ManifestUtil.readManifestSync(manifestInput) : manifestInput;
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

  #moduleFiles(module: ManifestModule, files: ManifestModuleFile[]): IndexedFile[] {
    return files.map(([file, type, _ts, role = 'std']) => {
      const isSource = type === 'ts' || type === 'js';
      const sourceFile = path.resolve(this.#manifest.workspace.path, module.sourceFolder, file);
      const js = isSource ? ManifestModuleUtil.withOutputExtension(file) : file;
      const outputFile = this.#resolveOutput(module.outputFolder, js);
      const moduleImport = `${module.name}/${file}`;
      let id = `${module.name}:${file}`;
      if (isSource) {
        id = ManifestModuleUtil.withoutSourceExtension(id);
      }

      return { id, type, sourceFile, outputFile, import: moduleImport, role, relativeFile: file, module: module.name };
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
      .map(module => ({
        ...module,
        outputPath: this.#resolveOutput(module.outputFolder),
        sourcePath: path.resolve(this.#manifest.workspace.path, module.sourceFolder),
        children: new Set(),
        files: TypedObject.fromEntries(
          TypedObject.entries(module.files).map(([folder, files]) => [folder, this.#moduleFiles(module, files ?? [])])
        )
      }));

    for (const module of this.#modules) {
      for (const files of Object.values(module.files ?? {})) {
        for (const entry of files) {
          this.#outputToEntry.set(entry.outputFile, entry);
          this.#sourceToEntry.set(entry.sourceFile, entry);
          this.#importToEntry.set(entry.import, entry);
          this.#importToEntry.set(ManifestModuleUtil.withoutSourceExtension(entry.import), entry);
          this.#importToEntry.set(ManifestModuleUtil.withOutputExtension(entry.import), entry);
        }
      }
    }
    this.#modulesByName = Object.fromEntries(this.#modules.map(module => [module.name, module]));

    // Store child information
    for (const module of this.#modules) {
      for (const parent of module.parents) {
        this.#modulesByName[parent]?.children.add(module.name);
      }
    }
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
    return this.#modules.filter(module => module.workspace);
  }

  /**
   * Find files from the index
   * @param config The configuration for controlling the find process
   */
  find(config: FindConfig): IndexedFile[] {
    const searchSpace: IndexedFile[] = [];
    for (const module of this.#modules) {
      if (config.module?.(module) ?? true) {
        for (const [folder, files] of TypedObject.entries(module.files)) {
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
    imp = ManifestModuleUtil.withoutSourceExtension(imp);
    return this.#importToEntry.get(imp);
  }

  /**
   * Get from import path or source file
   * @param importOrSource
   */
  getFromImportOrSource(importOrSource: string): IndexedFile | undefined {
    return this.getFromImport(importOrSource) ?? this.getFromSource(path.resolve(importOrSource));
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
   * Build module list from an expression list (e.g. `@travetto/web,-@travetto/log)
   */
  getModuleList(mode: 'workspace' | 'all', exprList: string = ''): Set<string> {
    const allModules = Object.keys(this.#manifest.modules);
    const active = new Set<string>(mode === 'workspace' ? this.getWorkspaceModules().map(item => item.name) : allModules);

    for (const expr of exprList.split(/,/g)) {
      const [, negative, module] = expr.trim().match(/(-|[+])?([^+\- ]{1,150})$/) ?? [];
      if (module) {
        const pattern = new RegExp(`^${module.replace(/[*]/g, '.*')}$`);
        for (const moduleName of allModules.filter(item => pattern.test(item))) {
          active[negative ? 'delete' : 'add'](moduleName);
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
        const module = this.getModule(next)!;
        toProcess.push(...module[field]);
        if (next !== this.#manifest.main.name) { // Do not include self
          out.push(module);
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
      module => module.sourceFolder.split('/'),
      sub =>
        !existsSync(path.resolve(base, ...sub, 'package.json')) &&
        !existsSync(path.resolve(base, ...sub, '.git'))
    );
    return lookup(file.replace(`${base}/`, '').split('/'));
  }

  /**
   * Find the module for an arbitrary import
   */
  findModuleForArbitraryImport(imp: string): IndexedModule | undefined {
    const importParts = imp.split('/');
    const module = imp.startsWith('@') ? importParts.slice(0, 2).join('/') : importParts[0];
    return this.getModule(module);
  }

  /**
   * Get manifest module by name
   */
  getManifestModule(module: string): ManifestModule {
    return this.manifest.modules[module];
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
   * @param importFile
   */
  getSourceFile(importFile: string | [string, string]): string {
    importFile = Array.isArray(importFile) ? importFile.join('/') : importFile;
    return this.getFromImport(importFile)?.sourceFile ?? importFile;
  }

  /**
   * Group by lineage, data can be duplicated
   */
  groupByLineage<T extends { action: string }>(items: { item: T, module: string }[]): Map<string, T[]> {
    const itemsByModule = new Map<string, T[]>();
    for (const event of items) {
      const moduleSet = new Set(this.getDependentModules(event.module, 'parents').map(module => module.name));
      moduleSet.add(this.manifest.workspace.name);
      for (const moduleName of moduleSet) {
        itemsByModule.getOrInsert(moduleName, []).push(event.item);
      }
    }
    return itemsByModule;
  }

  /**
   * Resolve child manifest relative to current manifest
   */
  resolveDependentManifest(moduleName: string): ManifestRoot {
    const moduleRoot = this.getManifestModule(moduleName)!.sourceFolder;
    const moduleContext = ManifestUtil.getModuleContext(this.manifest, moduleRoot);
    const manifestLocation = ManifestUtil.getManifestLocation(moduleContext, moduleName);
    return ManifestUtil.readManifestSync(manifestLocation);
  }

  /** Resolve a package command tied to workspace */
  resolvePackageCommand(cmd: string): string {
    return path.resolve(this.manifest.workspace.path, 'node_modules', '.bin', cmd);
  }
}