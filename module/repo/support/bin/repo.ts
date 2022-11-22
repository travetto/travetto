import * as fs from 'fs/promises';

import { Package, PackageUtil, path } from '@travetto/manifest';

import { DEP_GROUPS } from './types';
import { Npm } from './npm';

export type RepoModule = { full: string, rel: string, name: string, pkg: Package, ogPkg: Package, public: boolean };

type ByModule<T> = {
  name: Record<string, T>;
  rel: Record<string, T>;
  full: Record<string, T>;
}

type Graph = Map<RepoModule, Set<RepoModule>>;
type Lookup = ByModule<RepoModule>;

function getRepoMod(rel: string, full: string, pkg: Package): RepoModule {
  return {
    rel,
    full,
    name: pkg.name,
    pkg,
    ogPkg: structuredClone(pkg),
    public: pkg.private === false || pkg.private === undefined
  };
}

export class Repo {
  static #root: Promise<RepoModule>;
  static #modules: Promise<RepoModule[]>;
  static #lookup: Promise<Lookup>;
  static #graph: Promise<Graph>;

  static reinit(): void {
    this.#root = undefined as any;
    this.#modules = undefined as any;
    this.#lookup = undefined as any;
    this.#graph = undefined as any;
  }

  static async #getRoot(): Promise<RepoModule> {
    let folder = path.cwd();
    while (!fs.stat(`${folder}/.git`).catch(() => false)) {
      const nextFolder = path.dirname(folder);
      if (nextFolder === folder) {
        throw new Error(`Unable to find .git repository, starting at ${path.cwd()}`);
      }
      folder = nextFolder;
    }

    const pkg = PackageUtil.readPackage(folder);

    return getRepoMod('.', folder, pkg);
  }

  static async #getModules(): Promise<RepoModule[]> {
    const root = await this.root;


    const out: RepoModule[] = [];
    for (const folder of await Npm.getWorkspaceModules()) {
      const modFull = path.resolve(root.full, folder);
      const pkgFile = path.resolve(modFull, 'package.json');
      if (await fs.stat(pkgFile).catch(() => false)) {
        const rel = modFull.replace(`${root.full}/`, '');
        const pkg = await PackageUtil.readPackage(modFull);
        out.push(getRepoMod(rel, modFull, pkg));
      }
    }
    return out;
  }

  static async #getDeps(pkg: Package): Promise<RepoModule[]> {
    const byName = Object.fromEntries(
      (await this.modules).map((val) => [val.pkg.name, val] as const)
    );

    return [...DEP_GROUPS].flatMap(k =>
      Object.entries(pkg[k] ?? {})
        .map(([n]) => byName[n])
        .filter((x): x is RepoModule => !!x)
    );
  }

  static async #getGraph(): Promise<Graph> {
    const graph: Graph = new Map();
    for (const mod of await this.modules) {
      for (const dep of await this.#getDeps(mod.pkg)) {
        if (!graph.has(dep)) {
          graph.set(dep, new Set());
        }
        graph.get(dep)!.add(mod);
      }
    }
    return graph;
  }

  static async #getLookup(): Promise<Lookup> {
    const lookup: Lookup = { full: {}, name: {}, rel: {} };
    for (const mod of await this.modules) {
      lookup.full[mod.full] = mod;
      lookup.rel[mod.rel] = mod;
      lookup.name[mod.name] = mod;
    }

    return lookup;
  }

  static get root(): Promise<RepoModule> {
    return this.#root ??= this.#getRoot();
  }

  static get modules(): Promise<RepoModule[]> {
    return this.#modules ??= this.#getModules();
  }

  static get publicModules(): Promise<RepoModule[]> {
    return this.modules.then(mods => mods.filter(m => m.public));
  }

  static get graph(): Promise<Graph> {
    return this.#graph ??= this.#getGraph();
  }

  static get lookup(): Promise<Lookup> {
    return this.#lookup ??= this.#getLookup();
  }

  static async getDependentModules(root: RepoModule): Promise<RepoModule[]> {
    const graph = await this.graph;

    if (!graph.has(root)) {
      return [];
    }

    const process = [root];
    const out = new Set<RepoModule>([root]);

    while (process.length) {
      const next = process.shift()!;
      for (const el of (graph.get(next) ?? [])) {
        if (!out.has(el)) {
          out.add(el);
          process.push(el);
        }
      }
    }
    return [...out];
  }

  static writePackageJson(mod: RepoModule): Promise<void> {
    return fs.writeFile(
      path.resolve(mod.full, 'package.json'),
      JSON.stringify(mod.pkg, null, 2), 'utf8'
    );
  }
}