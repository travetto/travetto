import { Packages, Pkg, DEP_GROUPS } from './packages';
import { Semver, SemverLevel } from './semver';

export class Modules {
  private static _init = false;

  static _byPath: Record<string, Pkg>;
  static _byName: Record<string, string>;
  static _graph: Record<string, Set<string>>;

  private static getDeps(pkg: Pkg) {
    return [...DEP_GROUPS].$flatMap(k => Object.keys(pkg[k] ?? {}));
  }

  private static async init() {
    if (this._init) {
      return;
    }

    this._init = true;
    this._byPath = await Packages.cache
      .then(map => Object.entries(map)
        .$filter(([, pkg]) => pkg.publishConfig?.access !== 'restricted')
        .$collect()
      )
      .then(([all]) => Object.fromEntries(all));

    this._byName = Object.fromEntries(Object.entries(this._byPath).map(([a, b]) => [b.name, a]));

    this._graph = {};
    await Object.values(this._byPath)
      .$flatMap(pkg => this.getDeps(pkg)
        .$filter(k => !!this._byName[k])
        .$map(dep =>
          (this._graph[this._byName[dep]] ??= new Set()).add(this._byName[pkg.name])
        )
      );
  }

  static get graph() {
    return this.init().then(() => this._graph);
  }

  static get byPath() {
    return this.init().then(() => this._byPath);
  }

  static async getDependentModules(root: string) {
    await this.init();

    if (!this._graph[root]) {
      return new Set<string>();
    }

    const process = [root];
    const out = new Set([root]);
    while (process.length) {
      const first = process.shift()!;
      for (const el of this._graph[first] ?? []) {
        if (!out.has(el)) {
          out.add(el);
          process.push(el);
        }
      }
    }
    return out;
  }

  static async getDependentPackages(root: string) {
    return [...(await this.getDependentModules(root))].map(p => this._byPath[p]);
  }

  static async updateVersion(modPath: string, level: SemverLevel, prefix?: string) {
    const pkg = (await Modules.byPath)[modPath];
    const parsed = Semver.parse(pkg.version);
    const final = Semver.format(Semver.increment(parsed, level, prefix));
    for (const dPkg of await Modules.getDependentPackages(modPath)) {
      for (const key of DEP_GROUPS) {
        if (dPkg[key]?.[pkg.name]) {
          const val = dPkg[key]![pkg.name];
          dPkg[key]![pkg.name] = val.replace(pkg.version, final); // Only bump if matching
        }
      }
    }
    const msg = `Upgrading ${pkg.name} from ${pkg.version} to ${final}`;
    pkg.version = final;
    return msg;
  }

  static async * yieldPackagesJson() {
    await this.init();
    for (const [el, pkg] of Object.entries(this._byPath)) {
      yield [el, pkg] as const;
    }
  }
}
