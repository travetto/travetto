import * as fs from 'fs';

export const DEP_GROUPS = [
  'dependencies', 'devDependencies',
  'optionalPeerDependencies', 'peerDependencies',
  'optionalDependencies', 'docDependencies'
] as const;

export type Pkg = {
  name: string;
  main?: string;
  displayName?: string;
  homepage?: string;
  files?: string[];
  license?: string;
  description?: string;
  private?: boolean;
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  author?: {
    name?: string;
    email?: string;
  };
  repository?: {
    url: string;
    directory?: string;
  };
  keywords?: string[];
  version: string;
  publishConfig?: { access?: 'restricted' | 'public' };

} & Record<typeof DEP_GROUPS[number], Record<string, string> | undefined>;


export class Packages {
  private static combine(a: string[], ...b: string[]) {
    return [...new Set([...(a || []), ...(b || [])])];
  }

  private static _cache: Record<string, Pkg> = {};

  private static _init = false;

  private static async init() {
    if (this._init) {
      return;
    }
    this._init = true;
    this._cache = await '{module,related}/*/package.json'
      .$dir()
      .$map(p => [p.replace('/package.json', ''), require(p) as Pkg] as const)
      .$collect()
      .then(([all]) => Object.fromEntries(all));
  }

  static get cache() {
    return this.init().then(() => this._cache);
  }

  static standardize(file: string, {
    name, displayName, version, description,
    files, main, bin, scripts, keywords,
    dependencies, devDependencies, peerDependencies,
    optionalDependencies, optionalPeerDependencies,
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
        directory: file.replace(`${process.cwd()}/`, '').replace(/\/package.json/, '')
      },
      scripts,
      dependencies,
      devDependencies,
      peerDependencies,
      optionalDependencies,
      optionalPeerDependencies,
      engines,
      private: priv,
      publishConfig: {
        access: priv ? 'restricted' : 'public'
      },
      ...rest
    };
  }

  static upgrade(pth: string, pkg: Pkg, groups: typeof DEP_GROUPS[number][]) {
    return groups
      .$flatMap(type =>
        Object.entries<string>(pkg[type] || {})
          .$map(([dep, version]) => ({ dep, type, version }))
      )
      .$filter(x => !x.dep.startsWith('@travetto'))
      .$filter(x => /^[\^~<>]/.test(x.version)) // Rangeable
      .$parallel(({ dep, type, version }) =>
        $exec('npm', {
          args: ['show', `${dep}@${version}`, 'version', '--json'],
          spawn: { cwd: pth.replace(/\/package.json/, '') }
        })
          .$json()
          .$map(v => {
            const top = Array.isArray(v) ? v.pop() : v;
            const curr = pkg[type]![dep];
            const next = version.replace(/\d.*$/, top);
            if (next !== curr) {
              pkg[type]![dep] = next;
              return `${dep}@(${curr} -> ${next})`;
            }
          })
          .$onError(() => [])
      )
      .$notEmpty()
      .$collect();
  }

  static writeOut(file: string, pkg: Pkg) {
    return `${JSON.stringify(pkg, null, 2)}\n`
      .$stream('binary')
      .pipe(fs.createWriteStream(file.includes('package.json') ? file : `${file}/package.json`));
  }

  static async writeAll() {
    await this.init();

    for (const [pth, pkg] of Object.entries(this._cache)) {
      await this.writeOut(pth, pkg);
    }
  }

  static async * yieldPackagesJson() {
    await this.init();
    for (const [el, pkg] of Object.entries(this._cache)) {
      yield [`${el}/package.json`, pkg] as const;
    }
  }
}