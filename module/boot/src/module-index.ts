import fs from 'fs';

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
  module: string;
  source: string;
  output: string;
  profile: ManifestProfile;
  type: ManifestModuleFileType;
};

export type IndexedModule = ManifestModuleCore & {
  files: Record<string, IndexedFile[]>;
};

/**
 * Module index, files to be loaded at runtime
 */
class $ModuleIndex {

  #manifest: ManifestRoot;
  #modules: IndexedModule[];
  #root: string;
  #outputToEntry = new Map<string, IndexedFile>();
  #sourceToEntry = new Map<string, IndexedFile>();
  #importToEntry = new Map<string, IndexedFile>();

  constructor(root: string) {
    this.#root = root;
    this.#index();
  }

  #resolve(...parts: string[]): string {
    return path.resolve(this.#root, ...parts);
  }

  get manifest(): ManifestRoot {
    return this.#manifest;
  }

  #moduleFiles(m: ManifestModule, files: ManifestModuleFile[]): IndexedFile[] {
    return files.map(([f, type, ts, profile = 'std']) => {
      const source = path.join(m.source, f);
      const js = (type === 'ts' ? f.replace(/[.]ts$/, '.js') : f);
      const output = this.#resolve(m.output, js);
      const module = `${m.name}/${js}`;
      const id = module.replace(m.name, _ => `${_}:`).replace(/[.][tj]s$/, '');

      return { id, type, source, output, module, profile };
    });
  }

  /**
   * Get index of all source files
   */
  #index(): void {
    this.#manifest = JSON.parse(fs.readFileSync(this.#resolve('manifest.json'), 'utf8'));
    this.#modules = Object.values(this.manifest.modules)
      .map(m => ({
        ...m,
        output: this.#resolve(m.output),
        files: Object.fromEntries(
          Object.entries(m.files).map(([folder, files]) => [folder, this.#moduleFiles(m, files ?? [])])
        )
      }));

    for (const mod of this.#modules) {
      for (const files of Object.values(mod.files ?? {})) {
        for (const entry of files) {
          this.#outputToEntry.set(entry.output, entry);
          this.#sourceToEntry.set(entry.source, entry);
          this.#importToEntry.set(entry.module, entry);
        }
      }
    }
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
    return this.#modules.find(x => x.name === name);
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
   * Get module name from source file
   * @param source
   */
  getModuleNameFromSource(source: string): string | undefined {
    return this.#sourceToEntry.get(source)?.module;
  }

  /**
   * Get module from source file
   * @param source
   */
  getModuleFromSource(source: string): IndexedModule | undefined {
    const name = this.getModuleNameFromSource(source);
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
   * Build filter for module names
   */
  buildModuleFilter(exprList: string, defaults?: 'local' | 'all'): (mod: string) => boolean {
    const allMods = Object.keys(this.manifest.modules);
    const active = new Set<string>(
      defaults === 'local' ? this.getLocalModules().map(x => x.name) :
        (defaults === 'all' ? allMods : [])
    );

    for (const expr of exprList.split(/\s*,\s*/g)) {
      const [, neg, mod] = expr.match(/(-|[+])?([^+- ]+)$/)!;
      if (mod) {
        const patt = new RegExp(`^${mod.replace(/[*]/g, '.*')}$`);
        for (const m of allMods.filter(x => patt.test(x))) {
          active[neg ? 'delete' : 'add'](m);
        }
      }
    }
    return mod => active.has(mod);
  }
}

export const ModuleIndex = new $ModuleIndex(
  path.toPosix(process.env.TRV_OUTPUT ?? path.cwd())
);