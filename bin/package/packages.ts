import * as fs from 'fs';

import '@arcsine/nodesh';

import { PathUtil } from '@travetto/boot';
import { PackageType, readPackage } from '@travetto/boot/src/internal/package';

export const DEP_GROUPS = [
  'dependencies', 'devDependencies',
  'optionalPeerDependencies', 'peerDependencies',
  'optionalDependencies', 'docDependencies'
] as const;

export type DepGroup = (typeof DEP_GROUPS[number]);

export type PkgInfo = {
  folder: string;
  mod: string;
  folderRelative: string;
  folderPadded: string;
  file: string;
};

export type Pkg = PackageType & { _: PackageType & PkgInfo };

export class Packages {
  private static _cache: Pkg[];
  private static _byFolder: Record<string, Pkg>;

  private static combine(a: string[], ...b: string[]) {
    return [...new Set([...(a || []), ...(b || [])])];
  }

  private static readPackage(folder: string): Pkg {
    const file = PathUtil.resolveUnix(folder, 'package.json');
    const folderRelative = folder.replace(`${PathUtil.cwd}/`, '');
    return {
      _: {
        ...readPackage(folder), // Save original copy
        file,
        folder,
        mod: folderRelative.split('/').pop()!,
        folderPadded: folderRelative.padEnd(30),
        folderRelative
      },
      ...readPackage(folder)
    };
  }

  private static async init() {
    if (this._cache) {
      return;
    }
    this._cache = await '{module,related}/*/package.json'.$dir()
      .$map(p => this.readPackage(p.replace('/package.json', '')));
    this._byFolder = Object.fromEntries(this._cache.map(p => ([p._.folder, p] as const)));
  }

  static standardize({
    name, displayName, version, description,
    files, main, bin, scripts, keywords,
    dependencies, devDependencies, peerDependencies,
    optionalDependencies, optionalPeerDependencies,
    docDependencies,
    engines, private: priv, repository, author,
    publishConfig, ...rest
  }: Pkg): Pkg {
    return {
      name,
      displayName,
      version,
      description,
      keywords: this.combine(keywords as string[], 'travetto', 'typescript'),
      homepage: 'https://travetto.io',
      license: 'MIT',
      author: {
        email: 'travetto.framework@gmail.com',
        name: 'Travetto Framework'
      },
      files,
      main,
      bin,
      repository: {
        url: 'https://github.com/travetto/travetto.git',
        directory: rest._.folderRelative
      },
      scripts,
      dependencies,
      devDependencies,
      peerDependencies,
      optionalDependencies,
      optionalPeerDependencies,
      docDependencies,
      engines,
      private: priv,
      publishConfig: {
        access: priv ? 'restricted' : 'public'
      },
      ...rest
    };
  }

  static showVersion(folder: string, dep: string, version: string) {
    return $exec('npm', {
      args: ['show', `${dep}@${version}`, 'version', '--json'],
      spawn: { cwd: folder },
      singleValue: true
    })
      .$map(v => v ? JSON.parse(v) as (string | string[]) : '')
      .$map(v => Array.isArray(v) ? v.pop()! : v)
      .$notEmpty();
  }

  static showPackageVersion(pkg: Pkg) {
    return this.showVersion(pkg._.folder, pkg.name, pkg.version);
  }

  static upgrade(pkg: Pkg, groups: DepGroup[]) {
    return groups
      .$flatMap(type =>
        Object.entries<string>(pkg[type] || {})
          .$map(([name, version]) => ({ name, type, version }))
      )
      .$filter(x => !x.name.startsWith('@travetto'))
      .$filter(x => /^[\^~<>]/.test(x.version)) // Rangeable
      .$parallel(d => this.showVersion(pkg._.folder, d.name, d.version)
        .$map(top => {
          const curr = pkg[d.type]![d.name];
          const next = d.version.replace(/\d.*$/, top);
          if (next !== curr) {
            pkg[d.type]![d.name] = next;
            return `${d.name}@(${curr} -> ${next})`;
          }
        })
        .$onError(() => [])
      )
      .$notEmpty()
      .$collect();
  }

  static writeOut({ _: og, ...pkg }: Pkg) {
    return `${JSON.stringify(pkg, null, 2)}\n`
      .$stream('binary')
      .pipe(fs.createWriteStream(og.file));
  }

  static async * getTopLevelPackage() {
    yield this.readPackage(PathUtil.cwd);
  }

  static async getByFolder(folder: string) {
    await this.init();
    return this._byFolder[PathUtil.resolveUnix(folder)];
  }

  static async * yieldByFolder(folder: string) {
    yield this.getByFolder(folder);
  }

  static async * yieldPackages() {
    await this.init();
    yield* this._cache;
  }

  static yieldPublicPackages() {
    return this.yieldPackages().$filter(pkg => !pkg.private);
  }
}