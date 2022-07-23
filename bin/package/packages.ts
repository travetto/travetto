import '@arcsine/nodesh';
import { $AsyncIterable } from '@arcsine/nodesh/dist/types';

import { createWriteStream } from 'fs';

import { ExecUtil, PathUtil } from '@travetto/boot';
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
  static #cache: Pkg[];
  static #byFolder: Record<string, Pkg>;

  static #combine(a: string[], ...b: string[]): string[] {
    return [...new Set([...(a || []), ...(b || [])])];
  }

  static #readPackage(folder: string): Pkg {
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

  static async #init(): Promise<void> {
    if (this.#cache) {
      return;
    }
    this.#cache = await '{module,related}/*/package.json'.$dir()
      .$map(p => this.#readPackage(p.replace('/package.json', '')));
    this.#byFolder = Object.fromEntries(this.#cache.map(p => ([p._.folder, p] as const)));
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
      keywords: this.#combine(keywords!, 'travetto', 'typescript'),
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
      private: !!priv,
      publishConfig: {
        access: priv ? 'restricted' : 'public'
      },
      ...rest
    };
  }

  static findPublishedVersion(folder: string, dep: string, version: string): Promise<string | undefined> {
    return ExecUtil.spawn('npm',
      ['show', `${dep}@${version}`, 'version', '--json'],
      { cwd: folder, stdio: 'pipe' }
    ).result
      .catchAsResult!()
      .then(res => {
        if (!res.valid && !res.stderr.includes('E404')) {
          throw new Error(res.stderr);
        }
        const item = res.stdout ? JSON.parse(res.stdout) : [];
        return Array.isArray(item) ? item.pop() : item;
      });
  }

  static findPublishedPackageVersion(pkg: Pkg): Promise<string | undefined> {
    return this.findPublishedVersion(pkg._.folder, pkg.name, pkg.version);
  }

  static upgrade(pkg: Pkg, groups: DepGroup[]): $AsyncIterable<string[]> {
    return groups
      .$flatMap(type =>
        Object.entries<string | true>(pkg[type] || {})
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          .$map(([name, version]) => ({ name, type, version: version as string }))
      )
      .$filter(x => !x.name.startsWith('@travetto'))
      .$filter(x => /^[\^~<>]/.test(x.version)) // Is a range
      .$parallel(d => this.findPublishedVersion(pkg._.folder, d.name, d.version)
        .then((top): string => {
          if (top) {
            const curr = pkg[d.type]![d.name];
            const next = d.version.replace(/\d.*$/, top);
            if (next !== curr) {
              pkg[d.type]![d.name] = next;
              return `${d.name}@(${curr} -> ${next})`;
            }
          }
          return '';
        })
      )
      .$notEmpty()
      .$collect();
  }

  static writeOut({ _: og, ...pkg }: Pkg): Promise<void> {
    return new Promise(res => `${JSON.stringify(pkg, null, 2)}\n`
      .$stream('binary')
      .pipe(createWriteStream(og.file))
      .on('close', res));
  }

  static async * getTopLevelPackage(): $AsyncIterable<Pkg> {
    yield this.#readPackage(PathUtil.cwd);
  }

  static async getByFolder(folder: string): Promise<Pkg> {
    await this.#init();
    return this.#byFolder[PathUtil.resolveUnix(folder)];
  }

  static async * yieldByFolder(folder: string): $AsyncIterable<Pkg> {
    yield this.getByFolder(folder);
  }

  static async * yieldPackages(): $AsyncIterable<Pkg> {
    await this.#init();
    yield* this.#cache;
  }

  static yieldPublicPackages(): $AsyncIterable<Pkg> {
    return this.yieldPackages().$filter(pkg => !pkg.private);
  }
}