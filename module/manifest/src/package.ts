import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

import type { ManifestContext, NodePackageManager, Package, PackageVisitor, PackageVisitReq, PackageWorkspaceEntry } from './types';
import { path } from './path';
import { ManifestFileUtil } from './file';

/**
 * Utilities for querying, traversing and reading package.json files.
 */
export class PackageUtil {

  static #resolvers: Record<string, (imp: string) => string> = {};
  static #cache: Record<string, Package> = {};
  static #workspaces: Record<string, PackageWorkspaceEntry[]> = {};

  static #exec<T>(cwd: string, cmd: string): Promise<T> {
    const env = { PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH };
    const text = execSync(cmd, { cwd, encoding: 'utf8', env, stdio: ['pipe', 'pipe'] }).toString().trim();
    return JSON.parse(text);
  }

  /**
   * Clear out cached package file reads
   */
  static clearCache(): void {
    this.#cache = {};
    this.#workspaces = {};
  }

  /**
   * Resolve import given a manifest context
   */
  static resolveImport(imp: string, root?: string): string {
    const loc = path.resolve(root ?? '.', 'node_modules');
    return (this.#resolvers[loc] ??= createRequire(loc).resolve.bind(null))(imp);
  }

  /**
   * Resolve version path, if file: url
   */
  static resolveVersionPath(rootPath: string, ver: string): string | undefined {
    if (ver.startsWith('file:')) {
      return path.resolve(rootPath, ver.replace('file:', ''));
    } else {
      return;
    }
  }

  /**
   * Find package.json folder for a given dependency
   */
  static resolvePackagePath(name: string, root?: string): string {
    try {
      return path.dirname(this.resolveImport(`${name}/package.json`, root));
    } catch {
      try {
        const resolved = this.resolveImport(name, root);
        return path.join(resolved.split(name)[0], name);
      } catch { }
    }
    throw new Error(`Unable to resolve: ${name}`);
  }

  /**
   * Build a package visit req
   */
  static packageReq<T>(sourcePath: string, prod: boolean, topLevel?: boolean): PackageVisitReq<T> {
    return { pkg: this.readPackage(sourcePath), sourcePath, prod, topLevel };
  }

  /**
   * Extract all dependencies from a package
   */
  static getAllDependencies<T = unknown>(modulePath: string, local: boolean): PackageVisitReq<T>[] {
    const pkg = this.readPackage(modulePath);
    const children: Record<string, PackageVisitReq<T>> = {};
    for (const [deps, prod] of [
      [pkg.dependencies, true],
      ...(local ? [[pkg.devDependencies, false] as const] : []),
    ] as const) {
      for (const [name, version] of Object.entries(deps ?? {})) {
        const depPath = this.resolveVersionPath(modulePath, version) ?? this.resolvePackagePath(name);
        children[`${name}#${version}`] = this.packageReq<T>(depPath, prod, false);
      }
    }
    return Object.values(children).sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));
  }

  /**
   * Read a package.json from a given folder
   */
  static readPackage(modulePath: string, forceRead = false): Package {
    if (forceRead) {
      delete this.#cache[modulePath];
    }
    const res = this.#cache[modulePath] ??= ManifestFileUtil.readAsJsonSync(
      modulePath.endsWith('.json') ? modulePath : path.resolve(modulePath, 'package.json'),
    );

    res.name ??= 'untitled'; // If a package.json (root-only) is missing a name, allows for npx execution

    return res;
  }

  /**
   * import a package.json from a given module name
   */
  static importPackage(moduleName: string): Package {
    return this.readPackage(this.resolvePackagePath(moduleName));
  }

  /**
   * Visit packages with ability to track duplicates
   */
  static async visitPackages<T>(
    rootOrPath: PackageVisitReq<T> | string,
    visitor: PackageVisitor<T>
  ): Promise<Set<T>> {

    const root = typeof rootOrPath === 'string' ?
      this.packageReq<T>(rootOrPath, false, true) :
      rootOrPath;

    const seen = new Map<string, T>();
    const queue: PackageVisitReq<T>[] = [...await visitor.init?.(root) ?? [], root];
    const out = new Set<T>();

    while (queue.length) {
      const req = queue.pop();

      if (!req || (visitor.valid && !visitor.valid(req))) {
        continue;
      }

      const key = req.sourcePath;
      if (seen.has(key)) {
        await visitor.visit?.(req, seen.get(key)!);
      } else {
        const dep = await visitor.create(req);
        out.add(dep);
        await visitor.visit?.(req, dep);
        seen.set(key, dep);
        const children = this.getAllDependencies<T>(
          req.sourcePath,
          // We consider a module local if its not in the node_modules
          !req.sourcePath.includes('node_modules') && (
            // And its the root or we are in a monorepo
            root.sourcePath === req.sourcePath ||
            !!root.pkg.workspaces
          )
        );
        queue.push(...children.map(x => ({ ...x, parent: dep })));
      }
    }
    return (await visitor.complete?.(out)) ?? out;
  }

  /**
   * Find workspace values from rootPath
   */
  static async resolveWorkspaces(ctx: ManifestContext, rootPath: string): Promise<PackageWorkspaceEntry[]> {
    if (!this.#workspaces[rootPath]) {
      const cache = path.resolve(ctx.workspacePath, ctx.outputFolder, 'workspaces.json');
      try {
        return await ManifestFileUtil.readAsJson(cache);
      } catch (err) {
        let out: PackageWorkspaceEntry[];
        switch (ctx.packageManager) {
          case 'npm': {
            const res = await this.#exec<{ location: string, name: string }[]>(rootPath, 'npm query .workspace');
            out = res.map(d => ({ sourcePath: d.location, name: d.name }));
            break;
          }
          case 'yarn': {
            const res = await this.#exec<Record<string, { location: string }>>(rootPath, 'npm query .workspace');
            out = Object.entries(res).map(([name, { location }]) => ({ sourcePath: location, name }));
            break;
          }
        }

        this.#workspaces[rootPath] = out;

        await ManifestFileUtil.bufferedFileWrite(cache, out);
      }
    }
    return this.#workspaces[rootPath];
  }

  /**
   * Get an install command for a given npm module
   */
  static getInstallCommand(ctx: { packageManager: NodePackageManager }, pkg: string, prod = false): string {
    let install: string;
    switch (ctx.packageManager) {
      case 'npm': install = `npm i ${prod ? '' : '--save-dev '}${pkg}`; break;
      case 'yarn': install = `yarn add ${prod ? '' : '--dev '}${pkg}`; break;
    }
    return install;
  }
}