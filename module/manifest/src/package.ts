import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { execSync } from 'child_process';

import { Package, PackageDigest, PackageVisitor, PackageVisitReq, PackageWorkspaceEntry } from './types';
import { path } from './path';

export class PackageUtil {

  static #req = createRequire(`${path.cwd()}/node_modules`);
  static #framework: Package;
  static #cache: Record<string, Package> = {};
  static #workspaces: Record<string, PackageWorkspaceEntry[]> = {};

  static resolveImport = (library: string): string => this.#req.resolve(library);

  /**
   * Find package.json folder for a given dependency
   */
  static resolvePackageFolder(root: string, name: string, ver: string): string {
    if (ver.startsWith('file:')) {
      return path.resolve(root, ver.replace('file:', ''));
    } else {
      try {
        return path.dirname(this.resolveImport(`${name}/package.json`));
      } catch {
        try {
          const root = this.resolveImport(name);
          return path.join(root.split(name)[0], name);
        } catch { }
      }
    }
    throw new Error(`Unable to resolve: ${name}`);
  }

  /**
   * Extract all dependencies from a package
   * @returns 
   */
  static getAllDependencies<T = unknown>(root: string): PackageVisitReq<T>[] {
    const pkg = this.readPackage(root);
    const children: Record<string, PackageVisitReq<T>> = {};
    for (const [deps, rel] of [
      [pkg.dependencies, 'prod'],
      [pkg.devDependencies, 'dev'],
      [pkg.peerDependencies, 'peer'],
      [pkg.optionalDependencies, 'opt']
    ] as const) {
      for (const [name, version] of Object.entries(deps ?? {})) {
        const folder = this.resolvePackageFolder(root, name, version);
        children[`${name}#${version}`] = { folder, rel, pkg: this.readPackage(folder) };
      }
    }
    return Object.values(children).sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));
  }

  /**
   * Read a package.json from a given folder
   */
  static readPackage(folder: string): Package {
    return this.#cache[folder] ??= JSON.parse(readFileSync(
      folder.endsWith('.json') ? folder : path.resolve(folder, 'package.json'),
      'utf8'
    ));
  }

  /**
   * Visit packages with ability to track duplicates
   */
  static async visitPackages<T>(
    root: PackageVisitReq<T> | string,
    visitor: PackageVisitor<T>
  ): Promise<Set<T>> {

    const seen = visitor.cache ?? new Map();

    if (typeof root === 'string') {
      root = { folder: root, rel: 'direct', pkg: this.readPackage(root) };
    }

    const queue: PackageVisitReq<T>[] = await visitor.init?.(root) ?? [];

    queue.push(root);

    const out = new Set<T>();

    while (queue.length) {
      const req = queue.pop();

      if (!req || (visitor.valid && !visitor.valid(req))) {
        continue;
      }

      const key = req.folder;
      if (seen.has(key)) {
        await visitor.visit(req, seen.get(key)!);
      } else {
        const dep = await visitor.create(req);
        out.add(dep);
        await visitor.visit(req, dep);
        seen.set(key, dep);
        queue.push(...this.getAllDependencies<T>(req.folder).map(x => ({ ...x, parent: dep })));
      }
    }
    return (await visitor.complete?.(out)) ?? out;
  }

  /**
   * Get version of manifest package
   */
  static getFrameworkVersion(): string {
    return (this.#framework ??= this.readPackage(this.resolveImport('@travetto/manifest/package.json'))).version;
  }

  /**
   * Produce simple digest of    
   */
  static digest(pkg: Package): PackageDigest {
    const { main, name, author, license, version } = pkg;
    return { name, main, author, license, version, framework: this.getFrameworkVersion() };
  }

  /**
   * Find workspace values from folder
   */
  static resolveWorkspaces(folder: string): PackageWorkspaceEntry[] {
    if (!this.#workspaces[folder]) {
      const text = execSync('npm query .workspace', { cwd: folder, encoding: 'utf8' });
      const res: { location: string, name: string }[] = JSON.parse(text);
      this.#workspaces[folder] = res.map(d => ({ folder: d.location, name: d.name }));
    }
    return this.#workspaces[folder];
  }
}