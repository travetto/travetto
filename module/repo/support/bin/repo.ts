import * as fs from 'fs/promises';

import { Package, PackageUtil, path } from '@travetto/manifest';
import { DEP_GROUPS } from './types';

export type RepoModule = { folder: string, pkg: Package };

export class Repo {
  static #repoRoot: Promise<string>;
  static #modules: Promise<RepoModule[]>;
  static #byFolder: Promise<Record<string, RepoModule>>;
  static #byName: Promise<Record<string, RepoModule>>;
  static #graphByFolder: Promise<Record<string, Set<string>>>;

  static async #getRepoRoot(): Promise<string> {
    let folder = path.cwd();
    while (!fs.stat(`${folder}/.git`).catch(() => false)) {
      const nextFolder = path.dirname(folder);
      if (nextFolder === folder) {
        throw new Error(`Unable to find .git repository, starting at ${path.cwd()}`);
      }
      folder = nextFolder;
    }
    return folder;
  }

  static async #getModules(): Promise<RepoModule[]> {
    const root = await this.repoRoot;
    const pkg = await PackageUtil.readPackage(root);
    const moduleFolders = pkg.travettoRepo?.modules ?? ['module'];
    const out: RepoModule[] = [];
    for (const folder of moduleFolders) {
      const modRoot = path.resolve(root, folder);
      for (const sub of await fs.readdir(modRoot)) {
        if (sub.startsWith('.')) {
          continue;
        } else {
          const pkgFile = path.resolve(modRoot, sub, 'package.json');
          if (await fs.stat(pkgFile).catch(() => false)) {
            const rel = path.resolve(folder, sub);
            out.push({
              folder: rel, pkg: await PackageUtil.readPackage(pkgFile)
            });
          }
        }
      }
    }
    return out;
  }

  static #getDeps(pkg: Package): string[] {
    return [...DEP_GROUPS].flatMap(k =>
      Object.entries(pkg[k] ?? {})
        .filter(([, v]) => typeof v === 'string')
        .map(([n]) => n)
    );
  }

  static async #getGraphByFolder(): Promise<Record<string, Set<string>>> {
    const byName = Object.fromEntries(
      (await this.modules).map((val) => [val.pkg.name, val] as const)
    );

    const mapping: Record<string, Set<string>> = {};
    (await this.modules)
      .flatMap(({ folder: rel, pkg }) => this.#getDeps(pkg)
        .filter(k => !!byName[k])
        .map(dep =>
          (mapping[byName[dep].folder] ??= new Set()).add(byName[pkg.name].folder)
        )
      );
    return mapping;
  }

  static get repoRoot(): Promise<string> {
    return this.#repoRoot ??= this.#getRepoRoot();
  }

  static async getRepoPackage(): Promise<Package> {
    return PackageUtil.readPackage(await this.repoRoot);
  }

  static get modules(): Promise<RepoModule[]> {
    return this.#modules ??= this.#getModules();
  }

  static get publicModules(): Promise<RepoModule[]> {
    return this.modules.then(val => val.filter(m => m.pkg.private !== false));
  }

  static get modulesByFolder(): Promise<Record<string, RepoModule>> {
    return this.#byFolder ??= this.modules.then(x => Object.fromEntries(x.map(y => [y.folder, y])));
  }

  static get modulesByName(): Promise<Record<string, RepoModule>> {
    return this.#byName ??= this.modules.then(x => Object.fromEntries(x.map(y => [y.pkg.name, y])));
  }

  static get graphByFolder(): Promise<Record<string, Set<string>>> {
    return this.#graphByFolder ??= this.#getGraphByFolder();
  }

  static getModuleByFolder(rel: string): Promise<RepoModule> {
    return this.modulesByFolder.then(map => map[rel]);
  }

  static async getDependentModules(root: string | RepoModule): Promise<RepoModule[]> {

    if (typeof root !== 'string') {
      root = root.folder;
    }

    const graph = await this.graphByFolder;
    const byPath = await this.modulesByFolder;

    if (!graph[root]) {
      return [];
    }

    const process = [root];
    const out = new Set([root]);
    const ret: RepoModule[] = [];
    ret.push(byPath[root]);

    while (process.length) {
      const first = process.shift()!;
      for (const el of graph[first] ?? []) {
        if (!out.has(el)) {
          out.add(el);
          ret.push(byPath[el]);
          process.push(el);
        }
      }
    }
    return ret;
  }
}