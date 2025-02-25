import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { path } from './path';
import { ManifestFileUtil } from './file';

import { PackagePath, type Package, type PackageWorkspaceEntry } from './types/package';
import type { ManifestContext } from './types/context';
import type { NodePackageManager } from './types/common';

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
   * Resolve import given a manifest context
   */
  static resolveImport(imp: string, root?: string): string {
    const loc = path.resolve(root ?? '.', 'node_modules');
    return (this.#resolvers[loc] ??= createRequire(loc).resolve.bind(null))(imp);
  }

  /**
   * Resolve version path, if file: url
   */
  static resolveVersionPath(root: Package, ver: string): string | undefined {
    if (ver.startsWith('file:')) {
      return path.resolve(this.getPackagePath(root), ver.replace('file:', ''));
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
      } catch { // When import lookup fails
        let folder = root ?? process.cwd();
        let prev = '';
        while (folder !== prev) {
          const pkg = path.resolve(folder, 'node_modules', name, 'package.json');
          if (existsSync(pkg)) {
            return pkg;
          }
          prev = folder;
          folder = path.dirname(folder);
        }
      }
    }
    throw new Error(`Unable to resolve: ${name}`);
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

    res[PackagePath] = modulePath;
    return res;
  }

  /**
   * Get the package path
   */
  static getPackagePath(pkg: Package): string {
    return pkg[PackagePath]!;
  }

  /**
   * Find workspace values from rootPath
   */
  static async resolveWorkspaces(ctx: ManifestContext): Promise<PackageWorkspaceEntry[]> {
    const rootPath = ctx.workspace.path;
    const cache = path.resolve(rootPath, ctx.build.outputFolder, 'workspaces.json');
    return this.#workspaces[rootPath] ??= await ManifestFileUtil.readAsJson<PackageWorkspaceEntry[]>(cache)
      .catch(async () => {
        let out: PackageWorkspaceEntry[];
        switch (ctx.workspace.manager) {
          case 'yarn':
          case 'npm': {
            const res = await this.#exec<{ location: string, name: string }[]>(rootPath, 'npm query .workspace');
            out = res.map(d => ({ path: path.resolve(ctx.workspace.path, d.location), name: d.name }));
            break;
          }
        }
        await ManifestFileUtil.bufferedFileWrite(cache, JSON.stringify(out));
        return out;
      });
  }

  /**
   * Get an install command for a given npm module
   */
  static getInstallCommand(ctx: { workspace: { manager: NodePackageManager } }, pkg: string, prod = false): string {
    let install: string;
    switch (ctx.workspace.manager) {
      case 'npm': install = `npm i ${prod ? '' : '--save-dev '}${pkg}`; break;
      case 'yarn': install = `yarn add ${prod ? '' : '--dev '}${pkg}`; break;
    }
    return install;
  }
}