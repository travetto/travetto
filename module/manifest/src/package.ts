import { readFileSync } from 'fs';
import fs from 'fs/promises';
import { createRequire } from 'module';
import { execSync } from 'child_process';

import { Package, PackageDigest, PackageRel, PackageVisitor, PackageVisitReq, PackageWorkspaceEntry } from './types';
import { path } from './path';

export class PackageUtil {

  static #req = createRequire(`${path.cwd()}/node_modules`);
  static #framework: Package;
  static #cache: Record<string, Package> = {};
  static #workspaces: Record<string, PackageWorkspaceEntry[]> = {};

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
    for (const [deps, rel] of [
      [pkg.dependencies, 'prod'],
      [pkg.peerDependencies, 'peer'],
      [pkg.optionalDependencies, 'opt'],
      ...(modulePath === rootPath ? [[pkg.devDependencies, 'dev'] as const] : []),
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
  static readPackage(modulePath: string): Package {
    return this.#cache[modulePath] ??= JSON.parse(readFileSync(
      modulePath.endsWith('.json') ? modulePath : path.resolve(modulePath, 'package.json'),
      'utf8'
    ));
  }

  /**
   * import a package.json from a given module name
   */
  static importPackage(moduleName: string): Package {
    return this.readPackage(this.resolvePackagePath(moduleName));
  }

  /**
   * Write package
   */
  static async writePackage(modulePath: string, pkg: Package): Promise<void> {
    await fs.writeFile(path.resolve(modulePath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
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
   * Get version of manifest package
   */
  static getFrameworkVersion(): string {
    return (this.#framework ??= this.importPackage('@travetto/manifest')).version;
  }

  /**
   * Produce simple digest of
   */
  static digest(pkg: Package): PackageDigest {
    const { main, name, author, license, version } = pkg;
    return { name, main, author, license, version, framework: this.getFrameworkVersion() };
  }

  /**
   * Find workspace values from rootPath
   */
  static resolveWorkspaces(rootPath: string): PackageWorkspaceEntry[] {
    if (!this.#workspaces[rootPath]) {
      const text = execSync('npm query .workspace', { cwd: rootPath, encoding: 'utf8' });
      const res: { location: string, name: string }[] = JSON.parse(text);
      this.#workspaces[rootPath] = res.map(d => ({ sourcePath: d.location, name: d.name }));
    }
    return this.#workspaces[rootPath];
  }
}