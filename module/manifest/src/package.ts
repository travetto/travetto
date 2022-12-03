import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { execSync } from 'child_process';

import { ManifestProfile, Package, PackageDigest, PACKAGE_STD_PROFILE } from './types';
import { path } from './path';

export type Dependency = Package['travetto'] & {
  version: string;
  name: string;
  internal?: boolean;
  folder: string;
  parentSet: Set<string>;
  profileSet: Set<ManifestProfile>;
};

type CollectState = {
  profiles: Set<ManifestProfile>;
  seen: Map<string, Dependency>;
  parent?: string;
};

export class PackageUtil {

  static #req = createRequire(`${process.cwd()}/node_modules`);
  static #framework: Package;

  static resolveImport = (library: string): string => this.#req.resolve(library);

  /**
   * Read a package.json from a given folder
   */
  static readPackage(folder: string): Package {
    return JSON.parse(readFileSync(path.resolve(folder, 'package.json'), 'utf8'));
  }

  /**
   * Get version of manifest package
   */
  static getFrameworkVersion(): string {
    return (this.#framework ??= this.readPackage(path.dirname(this.resolveImport('@travetto/manifest/package.json')))).version;
  }

  /**
   * Produce simple digest of package
   */
  static digest(pkg: Package): PackageDigest {
    const { main, name, author, license, version } = pkg;
    return { name, main, author, license, version, framework: this.getFrameworkVersion() };
  }

  /**
   * Find workspace values from folder
   */
  static async resolveWorkspaceFolders(folder: string): Promise<string[]> {
    const text = execSync('npm query .workspace', { cwd: folder, encoding: 'utf8' });
    const res: { location: string }[] = JSON.parse(text);
    return res.map(d => d.location);
  }

  /**
   * Find packages for a given folder (package.json), decorating dependencies along the way
   */
  static async collectDependencies(
    folder: string,
    inState: Partial<CollectState> = {},
    isModule?: boolean
  ): Promise<Dependency[]> {
    const state: CollectState = { seen: new Map(), profiles: new Set(), ...inState };

    const { name, version, dependencies = {}, devDependencies = {}, workspaces, travetto, ['private']: isPrivate } = this.readPackage(folder);
    isModule ??= (!!travetto || folder === path.cwd());

    if (state.seen.has(name)) {
      const self = state.seen.get(name)!;
      for (const el of state.profiles) {
        (self.profileSet ??= new Set()).add(el);
      }
      if (state.parent) {
        (self.parentSet ??= new Set()).add(state.parent);
      }
      return [];
    } else if (!isModule) {
      return [];
    }

    const profileSet = new Set([...travetto?.profiles ?? [PACKAGE_STD_PROFILE], ...state.profiles]);

    const rootDep: Dependency = {
      name, version, folder,
      profileSet,
      internal: isPrivate === true,
      parentSet: new Set(state.parent ? [state.parent] : [])
    };
    state.seen.set(name, rootDep);

    const out: Dependency[] = [rootDep];

    const searchSpace: (readonly [name: string, version: string, type: 'dep' | 'dev', profileSet: Set<ManifestProfile>, isModule?: boolean])[] = [
      ...Object.entries(dependencies).map(([k, v]) => [k, v, 'dep', profileSet, undefined] as const),
      ...Object.entries(devDependencies).map(([k, v]) => [k, v, 'dev', profileSet, undefined] as const)
    ].sort((a, b) => a[0].localeCompare(b[0]));

    // We have a monorepo, collect local modules, and global-tests as needed
    if (workspaces) {
      const resolved = await this.resolveWorkspaceFolders(folder);
      for (const mod of resolved) {
        const pkg = PackageUtil.readPackage(mod);
        searchSpace.push([pkg.name, '*', 'dep', new Set(), true]);
      }
    }

    for (const [el, value, _, profiles, isDepModule] of searchSpace) {
      let next: string;
      if (value.startsWith('file:')) {
        next = path.resolve(folder, value.replace('file:', ''));
      } else {
        try {
          next = path.dirname(this.resolveImport(`${el}/package.json`));
        } catch {
          continue;
        }
      }
      out.push(...await this.collectDependencies(next, { seen: state.seen, parent: name, profiles }, isDepModule));
    }
    return out;
  }
}