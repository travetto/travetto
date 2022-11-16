import * as  fs from 'fs/promises';
import { statSync } from 'fs';
import * as  os from 'os';

import { path } from './path';
import { PackageUtil } from './package';
import {
  ManifestDelta, ManifestDeltaEvent, ManifestDeltaModule,
  ManifestModule, ManifestModuleFile, ManifestModuleFileType,
  ManifestModuleFolders, ManifestModuleFolderType, ManifestRoot,
  ManifestState, Package
} from './types';

const resolveImport = (library: string): string => require.resolve(library);

const VALID_SOURCE_FOLDERS = new Set<ManifestModuleFolderType>(['bin', 'src', 'support', '$index', '$package']);

const EXT_MAPPING: Record<string, ManifestModuleFileType> = {
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.json': 'json',
  '.ts': 'ts'
};

type Dependency = Package['travetto'] & { version: string, name: string, folder: string };

/**
 * Manifest utils
 */
export class ManifestUtil {

  static #getNewest(stat: { mtimeMs: number, ctimeMs: number }): number {
    return Math.max(stat.mtimeMs, stat.ctimeMs);
  }

  /**
   * Find packages for a given folder (package.json), decorating dependencies along the way
   */
  static async #collectPackages(folder: string, transitiveProfiles: string[] = [], seen = new Map<string, Dependency>()): Promise<Dependency[]> {
    const { name, version, dependencies = {}, devDependencies = {}, peerDependencies = {}, travetto } = PackageUtil.readPackage(folder);

    if (seen.has(name)) {
      const dep = seen.get(name);
      if (dep && dep.profileInherit !== false) {
        for (const el of transitiveProfiles) {
          (dep.profiles ??= []).push(el);
        }
      }
      return [];
    }

    const isModule = !!travetto || folder === path.cwd();
    if (!isModule) {
      return [];
    }

    const profiles = travetto?.profileInherit !== false ?
      [...travetto?.profiles ?? [], ...transitiveProfiles] :
      [...travetto?.profiles ?? []].slice(0);

    const rootDep: Dependency = { id: travetto?.id, name, version, folder, profiles, profileInherit: travetto?.profileInherit };
    seen.set(name, rootDep);

    const out: Dependency[] = [rootDep];

    const searchSpace = [
      ...Object.entries(dependencies).map(([k, v]) => [k, v, 'dep']),
      ...Object.entries(devDependencies).map(([k, v]) => [k, v, 'dev']),
      ...Object.entries(peerDependencies).map(([k, v]) => [k, v, 'peer'])
        .filter(([x]) => {
          try {
            resolveImport(x);
            return true;
          } catch {
            return false;
          }
        }),
    ].sort(([a, b]) => a[0].localeCompare(b[0]));

    for (const [el, value, type] of searchSpace) {
      const subProfiles = type === 'peer' ? transitiveProfiles : profiles;
      if (value.startsWith('file:')) {
        out.push(...await this.#collectPackages(path.resolve(folder, value.replace('file:', '')), subProfiles, seen));
      } else {
        /** @type {string} */
        let next;
        try {
          next = path.resolve(resolveImport(el));
        } catch {
          continue;
        }
        next = next.replace(new RegExp(`^(.*node_modules/${el})(.*)$`), (_, first) => first);
        out.push(...await this.#collectPackages(next, subProfiles, seen));
      }
    }
    return out;
  }

  /**
   * Get file type for a file name
   */
  static getFileType(moduleFile: string): ManifestModuleFileType {
    if (moduleFile === 'package.json') {
      return 'package-json';
    } else if (moduleFile.includes('support/fixtures/') || moduleFile.includes('test/fixtures/') || moduleFile.includes('support/resources/')) {
      return 'fixture';
    } else if (moduleFile.endsWith('.d.ts')) {
      return 'typings';
    } else {
      const ext = path.extname(moduleFile);
      return EXT_MAPPING[ext] ?? 'unknown';
    }
  }

  /**
   * Get folder key
   */
  static getFolderKey(moduleFile: string): ManifestModuleFolderType {
    const folderLocation = moduleFile.indexOf('/');
    if (folderLocation > 0) {
      if (moduleFile.startsWith('test/fixtures')) {
        return 'test/fixtures';
      } else if (moduleFile.startsWith('support/fixtures')) {
        return 'support/fixtures';
      } else if (moduleFile.startsWith('support/resources')) {
        return 'support/resources';
      }
      const key = moduleFile.substring(0, folderLocation);
      switch (key) {
        case 'src':
        case 'bin':
        case 'test':
        case 'resources':
        case 'support': return key;
        default: return '$other';
      }
    } else if (moduleFile === 'index.ts' || moduleFile === 'index.js') {
      return '$index';
    } else if (moduleFile === 'package.json') {
      return '$package';
    } else {
      return '$root';
    }
  }

  /**
   * Simple file scanning
   */
  static async #scanFolder(folder: string, includeTopFolders = new Set<string>()): Promise<string[]> {
    const out: string[] = [];
    if (!fs.stat(folder).catch(() => false)) {
      return out;
    }
    const stack: [string, number][] = [[folder, 0]];
    while (stack.length) {
      const popped = stack.pop();
      if (!popped) {
        continue;
      }

      const [top, depth] = popped;

      // Don't navigate into sub-folders with package.json's
      if (top !== folder && await fs.stat(`${top}/package.json`).catch(() => false)) {
        continue;
      }

      for (const sub of await fs.readdir(top)) {
        const stat = await fs.stat(`${top}/${sub}`);
        if (stat.isFile()) {
          out.push(`${top}/${sub}`);
        } else {
          if (!sub.includes('node_modules') && !sub.startsWith('.') && (depth > 0 || !includeTopFolders.size || includeTopFolders.has(sub))) {
            stack.push([`${top}/${sub}`, depth + 1]);
          }
        }
      }
    }
    return out;
  }

  /**
   * Convert file (by ext) to a known file type and also retrieve its latest timestamp
   */
  static async #transformFile(moduleFile: string, full: string): Promise<ManifestModuleFile> {
    return [moduleFile, this.getFileType(moduleFile), this.#getNewest(await fs.stat(full))];
  }

  /**
   * Visit a module and describe files, and metadata
   */
  static async #describeModule(rootFolder: string, { id, name, version, folder, profiles }: Dependency): Promise<ManifestModule> {
    const main = folder === rootFolder;
    const local = (!folder.includes('node_modules') && !name.startsWith('@travetto')) || main;

    const files: ManifestModuleFolders = {};
    const folderSet = !main ? new Set(['src', 'bin', 'support']) : new Set<string>();

    for (const file of await this.#scanFolder(folder, folderSet)) {
      // Group by top folder
      const moduleFile = file.replace(`${folder}/`, '');
      const entry = await this.#transformFile(moduleFile, file);
      const key = this.getFolderKey(moduleFile);
      (files[key] ??= []).push(entry);
    }

    // Refine non-main module
    if (!main) {
      files.$root = files.$root?.filter(([file, type]) => type !== 'ts');
    }

    // Cleaning up names
    id ??= (!local ? `@npm:${name}` : name).replace('/', ':');

    return {
      id,
      profiles: profiles?.includes('*') ? [] : [...new Set(profiles?.filter(x => x !== '*'))],
      name,
      version,
      main,
      local,
      source: folder,
      output: `node_modules/${name}`,
      files
    };
  }

  /**
   * Produce all modules for a given manifest folder, adding in some given modules when developing framework
   */
  static async #buildManifestModules(rootFolder: string): Promise<Record<string, ManifestModule>> {
    const modules = (await this.#collectPackages(rootFolder, ['*']));

    // TODO: Revisit logic
    if (!modules.some(x => x.name === '@travetto/cli')) {
      const folder = path.resolve(__dirname, '..', '..', '..', 'cli');
      if (await fs.stat(folder).catch(() => false)) {
        modules.unshift(...(await this.#collectPackages(folder, ['*'])));
      }
    }

    // TODO: Revisit logic
    if (!modules.some(x => x.name === '@travetto/test')) {
      const folder = path.resolve(__dirname, '..', '..', '..', 'test');
      if (await fs.stat(folder).catch(() => false)) {
        modules.unshift(...(await this.#collectPackages(folder, ['*'])));
      }
    }

    const out: Record<string, ManifestModule> = {};
    for (const mod of modules.sort((a, b) => a.name.localeCompare(b.name))) {
      const cfg = await this.#describeModule(rootFolder, mod);
      out[cfg.name] = cfg;
    }
    return out;
  }

  /**
   * Collapse all files in a module
   * @param {ManifestModule} m
   * @returns {}
   */
  static #flattenModuleFiles(m: ManifestModule): Record<string, ManifestModuleFile> {
    const out: Record<string, ManifestModuleFile> = {};
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const key of Object.keys(m.files) as (ManifestModuleFolderType[])) {
      if (!VALID_SOURCE_FOLDERS.has(key)) {
        continue;
      }
      for (const [name, type, date] of m.files?.[key] ?? []) {
        if (type === 'ts' || type === 'js' || type === 'json' || type === 'package-json') {
          out[name] = [name, type, date];
        }
      }
    }
    return out;
  }

  /**
   * Produce delta between two manifest modules, relative to an output folder
   */
  static async #deltaModules(outputFolder: string, left: ManifestDeltaModule, right: ManifestDeltaModule): Promise<ManifestDeltaEvent[]> {
    const out: ManifestDeltaEvent[] = [];
    for (const el of Object.keys(left.files)) {
      if (!(el in right.files)) {
        out.push([el, 'added']);
      } else {
        const [, , leftTs] = left.files[el];
        const [, , rightTs] = right.files[el];
        if (leftTs !== rightTs) {
          out.push([el, 'changed']);
        } else {
          try {
            const stat = await fs.stat(`${outputFolder}/${left.output}/${el.replace(/[.]ts$/, '.js')}`);
            if (this.#getNewest(stat) < leftTs) {
              out.push([el, 'dirty']);
            }
          } catch {
            out.push([el, 'missing']);
          }
        }
      }
    }
    for (const el of Object.keys(right.files)) {
      if (!(el in left.files)) {
        out.push([el, 'removed']);
      }
    }
    return out;
  }

  /**
   * Utility for manifest boilerplate
   */
  static wrapModules(modules: Record<string, ManifestModule>): ManifestRoot {
    return {
      main: Object.values(modules).find(x => x.main)?.name ?? '__tbd__',
      modules, generated: Date.now(),
      buildLocation: '__tbd__'
    };
  }

  /**
   * Produce manifest in memory
   */
  static async buildManifest(rootFolder: string): Promise<ManifestRoot> {
    return this.wrapModules(await this.#buildManifestModules(rootFolder));
  }

  /**
   * Read manifest from a folder
   */
  static async readManifest(folder: string): Promise<ManifestRoot> {
    const file = path.resolve(folder, 'manifest.json');
    if (await fs.stat(file).catch(() => false)) {
      return JSON.parse(
        await fs.readFile(file, 'utf8')
      );
    } else {
      return this.wrapModules({});
    }
  }

  /**
   * Produce delta between ttwo manifest roots, relative to a single output folder
   */
  static async produceDelta(outputFolder: string, left: ManifestRoot, right: ManifestRoot): Promise<ManifestDelta> {
    const deltaLeft = Object.fromEntries(
      Object.values(left.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const deltaRight = Object.fromEntries(
      Object.values(right.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const out: Record<string, ManifestDeltaEvent[]> = {};

    for (const [name, lMod] of Object.entries(deltaLeft)) {
      out[name] = await this.#deltaModules(outputFolder, lMod, deltaRight[name] ?? { files: {}, name });
    }

    return out;
  }

  /**
   * Load state from disk
   */
  static async readState(file: string): Promise<ManifestState> {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  }

  /**
   * Persist state to disk in a temp file, return said temp file
   */
  static async writeState(state: ManifestState, file?: string): Promise<string> {
    const manifestTemp = file ?? path.resolve(os.tmpdir(), `manifest-state.${Date.now()}${Math.random()}.json`);
    await fs.writeFile(manifestTemp, JSON.stringify(state), 'utf8');
    return manifestTemp;
  }

  /**
   * Generate the manifest and delta as a single output
   */
  static async produceState(rootFolder: string, outputFolder: string): Promise<ManifestState> {
    const manifest = await this.buildManifest(rootFolder);
    const oldManifest = await this.readManifest(outputFolder);
    const delta = await this.produceDelta(outputFolder, manifest, oldManifest);
    return { manifest, delta };
  }

  /**
   * Update manifest module file
   */
  static updateManifestModuleFile(module: ManifestModule, moduleFile: string, action: 'create' | 'delete' | 'update'): void {
    const fileKey = this.getFolderKey(moduleFile);
    const sourceFile = `${module.source}/${moduleFile}`;
    const idx = module.files[fileKey]?.findIndex(([f]) => f === moduleFile);

    switch (action) {
      case 'create': {
        (module.files[fileKey] ??= []).push([moduleFile, this.getFileType(moduleFile), this.#getNewest(statSync(sourceFile))]);
        break;
      }
      case 'delete': {
        if (idx !== undefined && idx >= 0) {
          module.files[fileKey]!.splice(idx, 1);
        }
        break;
      }
      case 'update': {
        if (idx !== undefined && idx >= 0) {
          module.files[fileKey]![idx][2] = this.#getNewest(statSync(sourceFile));
        }
        break;
      }
    }
  }
}