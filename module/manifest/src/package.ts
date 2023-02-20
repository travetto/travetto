import { readFileSync } from 'fs';
import fs from 'fs/promises';
import { createRequire } from 'module';
import { execSync } from 'child_process';

import { ManifestContext, Package, PackageDigest, PackageRel, PackageVisitor, PackageVisitReq, PackageWorkspaceEntry } from './types';
import { path } from './path';

export class PackageUtil {

  static #req = createRequire(path.resolve('node_modules'));
  static #framework: Package;
  static #cache: Record<string, Package> = {};
  static #workspaces: Record<string, PackageWorkspaceEntry[]> = {};

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
   * Write package
   */
  static async writePackageIfChanged(modulePath: string, pkg: Package): Promise<void> {
    const final = JSON.stringify(pkg, null, 2);
    const target = path.resolve(modulePath, 'package.json');
    const current = (await fs.readFile(target, 'utf8').catch(() => '')).trim();
    if (final !== current) {
      await fs.writeFile(target, `${final}\n`, 'utf8');
    }
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
            const text = execSync('npm query .workspace', { cwd: rootPath, encoding: 'utf8', env: { PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH } });
            out = JSON.parse(text)
              .map((d: { location: string, name: string }) => ({ sourcePath: d.location, name: d.name }));
            break;
          }
          case 'yarn': {
            const text = execSync('yarn -s workspaces info', { cwd: rootPath, encoding: 'utf8', env: { PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH } });
            out = Object.entries<{ location: string }>(JSON.parse(text))
              .map(([name, { location }]) => ({ sourcePath: location, name }));
            break;
          }
          default: throw new Error(`Unknown package manager: ${ctx.packageManager}`);
        }

        this.#workspaces[rootPath] = out;

        await fs.writeFile(cache, JSON.stringify(out), 'utf8');
      }
    }
    return this.#workspaces[rootPath];
  }

  /**
   * Sync versions across a series of folders
   */
  static async syncVersions(folders: string[], versionMapping: Record<string, string> = {}): Promise<void> {
    const packages = folders.map(folder => {
      const pkg = this.readPackage(folder, true);
      versionMapping[pkg.name] = `^${pkg.version}`;
      return { folder, pkg };
    });

    for (const { pkg } of packages) {
      for (const group of [
        pkg.dependencies ?? {},
        pkg.devDependencies ?? {},
        pkg.optionalDependencies ?? {},
        pkg.peerDependencies ?? {}
      ]) {
        for (const [mod, ver] of Object.entries(versionMapping)) {
          if (mod in group && !/^[*]|(file:.*)$/.test(group[mod])) {
            group[mod] = ver;
          }
        }
      }
    }

    for (const { folder, pkg } of packages) {
      await this.writePackageIfChanged(folder, pkg);
    }
  }
}