import { Packages, Pkg, DEP_GROUPS } from './packages';
import { Semver, SemverLevel } from './semver';

export class Modules {
  static #initialized: boolean = false;
  static #graphByFolder: Record<string, Set<string>>;

  static #getDeps(pkg: Pkg) {
    return [...DEP_GROUPS].$flatMap(k =>
      Object.entries(pkg[k] ?? {})
        .filter(([, v]) => typeof v === 'string')
        .map(([n]) => n)
    );
  }

  static async #init() {
    if (this.#initialized) {
      return;
    }

    this.#initialized = true;

    const byName = await Packages.yieldPackages()
      .$map(pkg => [pkg.name, pkg] as const)
      .then((all) => Object.fromEntries(all));

    this.#graphByFolder = {};
    await Packages.yieldPackages()
      .$flatMap(pkg => this.#getDeps(pkg)
        .$filter(k => !!byName[k])
        .$map(dep =>
          (this.#graphByFolder[byName[dep]._.folder] ??= new Set()).add(byName[pkg.name]._.folder)
        )
      );
  }

  static get graphByFolder() {
    return this.#init().then(() => this.#graphByFolder);
  }

  static async * getDependentModules(root: string) {
    await this.#init();

    if (!this.#graphByFolder[root]) {
      return;
    }

    const process = [root];
    const out = new Set([root]);
    yield Packages.getByFolder(root);

    while (process.length) {
      const first = process.shift()!;
      for (const el of this.#graphByFolder[first] ?? []) {
        if (!out.has(el)) {
          out.add(el);
          yield Packages.getByFolder(el);
          process.push(el);
        }
      }
    }
  }

  static getDependentPackages(root: string | Pkg) {
    return this.getDependentModules(typeof root === 'string' ? root : root._.folder);
  }

  static async updateVersion(pkg: Pkg, level: SemverLevel, prefix?: string) {
    const parsed = Semver.parse(pkg.version);
    const final = Semver.format(Semver.increment(parsed, level, prefix));
    for await (const dPkg of this.getDependentPackages(pkg)) {
      for (const key of DEP_GROUPS) {
        const grp = dPkg[key];
        if (grp?.[pkg.name] && typeof grp[pkg.name] === 'string') {
          grp[pkg.name] = (grp[pkg.name] as string).replace(/\d.*/, final);
        }
      }
    }
    pkg.version = final;
    return pkg;
  }
}