import { readFileSync } from 'fs';
import fs from 'fs/promises';
import { createRequire } from 'module';
import { execSync } from 'child_process';

import { ManifestContext, Package, PackageRel, PackageVisitor, PackageVisitReq, PackageWorkspaceEntry } from './types';
import { path } from './path';

/**
 * Utilities for querying, traversing and reading package.json files.
 */
export class PackageUtil {

  static #req = createRequire(path.resolve('node_modules'));
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

  static resolveImport = (library: string): string => this.#req.resolve(library);

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
  static resolvePackagePath(name: string): string {
    try {
      return path.dirname(this.resolveImport(`${name}/package.json`));
    } catch {
      try {
        const resolved = this.resolveImport(name);
        return path.join(resolved.split(name)[0], name);
      } catch { }
    }
    throw new Error(`Unable to resolve: ${name}`);
  }

  /**
   * Build a package visit req
   */
  static packageReq<T>(sourcePath: string, rel: PackageRel): PackageVisitReq<T> {
    return { pkg: this.readPackage(sourcePath), sourcePath, rel };
  }

  /**
   * Extract all dependencies from a package
   */
  static getAllDependencies<T = unknown>(modulePath: string, rootPath: string): PackageVisitReq<T>[] {
    const pkg = this.readPackage(modulePath);
    const children: Record<string, PackageVisitReq<T>> = {};
    const local = modulePath === rootPath && !modulePath.includes('node_modules');
    for (const [deps, rel] of [
      [pkg.dependencies, 'prod'],
      [pkg.peerDependencies, 'peer'],
      [pkg.optionalDependencies, 'opt'],
      ...(local ? [[pkg.devDependencies, 'dev'] as const] : []),
    ] as const) {
      for (const [name, version] of Object.entries(deps ?? {})) {
        try {
          const depPath = this.resolveVersionPath(modulePath, version) ?? this.resolvePackagePath(name);
          children[`${name}#${version}`] = this.packageReq<T>(depPath, rel);
        } catch (err) {
          if (rel === 'opt' || (rel === 'peer' && !!pkg.peerDependenciesMeta?.[name].optional)) {
            continue;
          }
          throw err;
        }
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
    const res = this.#cache[modulePath] ??= JSON.parse(readFileSync(
      modulePath.endsWith('.json') ? modulePath : path.resolve(modulePath, 'package.json'),
      'utf8'
    ));

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
      this.packageReq<T>(rootOrPath, 'root') :
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
        const children = this.getAllDependencies<T>(req.sourcePath, root.sourcePath);
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
      await fs.mkdir(path.resolve(ctx.workspacePath, ctx.outputFolder), { recursive: true });
      const cache = path.resolve(ctx.workspacePath, ctx.outputFolder, 'workspaces.json');
      try {
        return JSON.parse(await fs.readFile(cache, 'utf8'));
      } catch {
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

        await fs.writeFile(cache, JSON.stringify(out), 'utf8');
      }
    }
    return this.#workspaces[rootPath];
  }
}