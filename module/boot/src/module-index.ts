import fs from 'fs';
import { createRequire } from 'module';

import {
  ManifestRoot, ManifestModule, ManifestModuleFile, ManifestModuleFileType,
  ManifestModuleCore, PACKAGE_STD_PROFILE, ManifestProfile
} from '@travetto/manifest';
import { path } from './path';

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
  import: string;
  module: string;
  source: string;
  output: string;
  profile: ManifestProfile;
  type: ManifestModuleFileType;
};

export type IndexedModule = ManifestModuleCore & {
  files: Record<string, IndexedFile[]>;
  workspaceRelative: string;
};

/**
 * Module index, files to be loaded at runtime
 */
class $ModuleIndex {

  #manifestFile: string;
  #manifest: ManifestRoot;
  #modules: IndexedModule[];
  #modulesByName: Record<string, IndexedModule> = {};
  #root: string;
  #outputToEntry = new Map<string, IndexedFile>();
  #sourceToEntry = new Map<string, IndexedFile>();
  #importToEntry = new Map<string, IndexedFile>();

  constructor(
    root: string | undefined = process.env.TRV_OUTPUT,
    manifestFile: string | undefined = process.env.TRV_MANIFEST
  ) {
    this.#root = root ?? process.cwd();
    this.#manifestFile = manifestFile ?? path.resolve(this.#root, 'manifest.json');
    if (!this.#manifestFile.endsWith('.json')) {
      // IF not a file
      const req = createRequire(path.resolve('node_modules'));
      this.#manifestFile = req.resolve(`${this.#manifestFile}/manifest.json`);
    }
    this.#index();
  }

  #resolveOutput(...parts: string[]): string {
    return path.resolve(this.#root, ...parts);
  }

  get manifest(): ManifestRoot {
    return this.#manifest;
  }

  get root(): string {
    return this.#root;
  }

  #moduleFiles(m: ManifestModule, files: ManifestModuleFile[]): IndexedFile[] {
    return files.map(([f, type, ts, profile = 'std']) => {
      const source = path.join(m.source, f);
      const js = (type === 'ts' ? f.replace(/[.]ts$/, '.js') : f);
      const output = this.#resolveOutput(m.output, js);
      const modImport = `${m.name}/${js}`;
      let id = modImport.replace(`${m.name}/`, _ => _.replace(/[/]$/, ':'));
      if (type === 'ts' || type === 'js') {
        id = id.replace(/[.]js$/, '');
      }

      return { id, type, source, output, import: modImport, profile, module: m.name };
    });
  }

  /**
   * Get index of all source files
   */
  #index(): void {
    this.#manifest = JSON.parse(fs.readFileSync(this.#manifestFile, 'utf8'));
    this.#modules = Object.values(this.manifest.modules)
      .map(m => ({
        ...m,
        output: this.#resolveOutput(m.output),
        workspaceRelative: m.source.replace(`${this.#manifest.workspacePath}/`, ''),
        files: Object.fromEntries(
          Object.entries(m.files).map(([folder, files]) => [folder, this.#moduleFiles(m, files ?? [])])
        )
      }));

    for (const mod of this.#modules) {
      for (const files of Object.values(mod.files ?? {})) {
        for (const entry of files) {
          this.#outputToEntry.set(entry.output, entry);
          this.#sourceToEntry.set(entry.source, entry);
          this.#importToEntry.set(entry.import, entry);
        }
      }
    }
    this.#modulesByName = Object.fromEntries(this.#modules.map(x => [x.name, x]));
  }

  #getEntry(file: string): IndexedFile | undefined {
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
    const { filter: f, folder } = config;
    const filter = f ? 'test' in f ? f.test.bind(f) : f : f;

    let idx = this.#modules;

    const checkProfile = config.checkProfile ?? true;

    const activeProfiles = new Set([PACKAGE_STD_PROFILE, ...(config.profiles ?? process.env.TRV_PROFILES?.split(/\s*,\s*/g) ?? [])]);

    if (checkProfile) {
      idx = idx.filter(m => m.profiles.length === 0 || m.profiles.some(p => activeProfiles.has(p)));
    }

    let searchSpace = folder ?
      idx.flatMap(m => [...m.files[folder] ?? [], ...(config.includeIndex ? (m.files.$index ?? []) : [])]) :
      idx.flatMap(m => [...Object.values(m.files)].flat());

    if (checkProfile) {
      searchSpace = searchSpace.filter(fi => activeProfiles.has(fi.profile));
    }

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
    return this.#modulesByName[name];
  }

  /**
   * Resolve import
   */
  resolveFileImport(name: string): string {
    name = !name.endsWith('.d.ts') ? name.replace(/[.]ts$/, '.js') : name;
    return this.#importToEntry.get(name)?.output ?? name;
  }

  /**
   * Get source file from output location
   * @param outputFile
   */
  getSourceFile(outputFile: string): string {
    return this.#outputToEntry.get(outputFile)?.source ?? outputFile;
  }

  /**
   * Get indexed module from source file
   * @param source
   */
  getFromSource(source: string): IndexedFile | undefined {
    return this.#sourceToEntry.get(source);
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
   * Load all source modules
   */
  async loadSource(): Promise<void> {
    for (const { output } of this.findSrc({})) {
      await import(output);
    }
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
  getDependentModules(root: IndexedModule): IndexedModule[] {
    const seen = new Set<string>();
    const out: IndexedModule[] = [];
    const toProcess = [root.name];
    while (toProcess.length) {
      const next = toProcess.shift()!;
      if (seen.has(next)) {
        continue;
      }
      const mod = this.getModule(next)!;
      toProcess.push(...mod.parents);
      out.push(mod);
    }
    return out;
  }
}

export const ModuleIndex = new $ModuleIndex();