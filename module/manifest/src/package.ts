import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import path from './path.ts';
import { ManifestFileUtil } from './file.ts';

import { PackagePathSymbol, type Package, type PackageWorkspaceEntry } from './types/package.ts';
import type { ManifestContext } from './types/context.ts';

/**
 * Utilities for querying, traversing and reading package.json files.
 */
export class PackageUtil {

  static #resolvers: Record<string, (imp: string) => string> = {};
  static #cache: Record<string, Package> = {};
  static #workspaces: Record<string, PackageWorkspaceEntry[]> = {};

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
        let previous = '';
        while (folder !== previous) {
          const pkg = path.resolve(folder, 'node_modules', name, 'package.json');
          if (existsSync(pkg)) {
            return pkg;
          }
          previous = folder;
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
    const nodePackage = this.#cache[modulePath] ??= ManifestFileUtil.readAsJsonSync(
      modulePath.endsWith('.json') ? modulePath : path.resolve(modulePath, 'package.json'),
    );

    nodePackage.name ??= 'untitled'; // If a package.json (root-only) is missing a name, allows for execution

    nodePackage[PackagePathSymbol] = modulePath;
    return nodePackage;
  }

  /**
   * Get the package path
   */
  static getPackagePath(pkg: Package): string {
    return pkg[PackagePathSymbol]!;
  }

  /**
   * Find workspace values from rootPath
   */
  static async resolveWorkspaces(ctx: ManifestContext): Promise<PackageWorkspaceEntry[]> {
    const rootPath = ctx.workspace.path;
    const cache = path.resolve(rootPath, ctx.build.outputFolder, 'workspaces.json');
    try {
      return this.#workspaces[rootPath] ??= ManifestFileUtil.readAsJsonSync(cache);
    } catch {
      let args: string[];
      switch (ctx.workspace.manager) {
        case 'yarn':
        case 'npm': args = ['query', '.workspace']; break;
        case 'pnpm': args = ['ls', '-r', '--depth', '-1', '--json']; break;
      }

      const env = { PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH };
      const text = execSync(`${ctx.workspace.manager} ${args.join(' ')}`, { cwd: rootPath, encoding: 'utf8', env, stdio: ['pipe', 'pipe'] });
      const out: PackageWorkspaceEntry[] = JSON.parse(text.trim());
      const filtered = out.map(item => ({ name: item.name, path: item.path }));
      await ManifestFileUtil.bufferedFileWrite(cache, JSON.stringify(filtered));
      return filtered;
    }
  }
}