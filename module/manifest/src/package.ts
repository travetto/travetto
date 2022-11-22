import { readFileSync } from 'fs';

import { Package, PackageDigest } from './types';
import { path } from './path';
import { version as framework } from '../package.json';

export type Dependency = Package['travetto'] & { version: string, name: string, folder: string };

export class PackageUtil {

  static resolveImport = (library: string): string => require.resolve(library);

  static readPackage(folder: string): Package {
    return JSON.parse(readFileSync(path.resolve(folder, 'package.json'), 'utf8'));
  }

  static digest(pkg: Package): PackageDigest {
    const { main, name, author, license, version } = pkg;
    return { name, main, author, license, version, framework };
  }

  /**
   * Find packages for a given folder (package.json), decorating dependencies along the way
   */
  static async collectDependencies(folder: string, transitiveProfiles: string[] = [], seen = new Map<string, Dependency>()): Promise<Dependency[]> {
    const { name, version, dependencies = {}, devDependencies = {}, peerDependencies = {}, travetto } = this.readPackage(folder);

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
            this.resolveImport(x);
            return true;
          } catch {
            return false;
          }
        }),
    ].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [el, value, type] of searchSpace) {
      const subProfiles = type === 'peer' ? transitiveProfiles : profiles;
      if (value.startsWith('file:')) {
        out.push(...await this.collectDependencies(path.resolve(folder, value.replace('file:', '')), subProfiles, seen));
      } else {
        let next: string;
        try {
          next = path.dirname(this.resolveImport(`${el}/package.json`));
        } catch {
          continue;
        }
        out.push(...await this.collectDependencies(next, subProfiles, seen));
      }
    }
    return out;
  }
}