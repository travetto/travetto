import { readFileSync } from 'fs';
import { createRequire } from 'module';

import { ManifestProfile, Package, PackageDigest, PACKAGE_STD_PROFILE } from './types';
import { path } from './path';

export type Dependency = Package['travetto'] & { version: string, name: string, folder: string };

export class PackageUtil {

  static #req = createRequire(`${process.cwd()}/node_modules`);
  static #framework: Package;

  static resolveImport = (library: string): string => this.#req.resolve(library);

  static readPackage(folder: string): Package {
    return JSON.parse(readFileSync(path.resolve(folder, 'package.json'), 'utf8'));
  }

  static getFrameworkVersion(): string {
    return (this.#framework ??= this.readPackage(path.dirname(this.resolveImport('@travetto/manifest/package.json')))).version;
  }

  static digest(pkg: Package): PackageDigest {
    const { main, name, author, license, version } = pkg;
    return { name, main, author, license, version, framework: this.getFrameworkVersion() };
  }

  /**
   * Find packages for a given folder (package.json), decorating dependencies along the way
   */
  static async collectDependencies(folder: string, transitiveProfiles: ManifestProfile[] = [], seen = new Map<string, Dependency>()): Promise<Dependency[]> {
    const { name, version, dependencies = {}, devDependencies = {}, travetto } = this.readPackage(folder);
    const isModule = !!travetto || folder === path.cwd();

    if (seen.has(name)) {
      const dep = seen.get(name);
      if (dep) {
        for (const el of transitiveProfiles) {
          (dep.profiles ??= []).push(el);
        }
      }
      return [];
    } else if (!isModule) {
      return [];
    }

    const profiles = [...travetto?.profiles ?? [PACKAGE_STD_PROFILE], ...transitiveProfiles].slice(0);

    const rootDep: Dependency = { id: travetto?.id, name, version, folder, profiles };
    seen.set(name, rootDep);

    const out: Dependency[] = [rootDep];

    const searchSpace = [
      ...Object.entries(dependencies).map(([k, v]) => [k, v, 'dep']),
      ...Object.entries(devDependencies).map(([k, v]) => [k, v, 'dev'])
    ].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [el, value] of searchSpace) {
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
      out.push(...await this.collectDependencies(next, profiles, seen));
    }
    return out;
  }
}