import * as path from 'path';

import { existsSync } from 'fs';

export type ResolvedDep = { file: string, type: DepType, dep: string, version: string };
export type DepType = 'prod' | 'dev' | 'opt' | 'peer';

type DepResolveConfig = { root?: string, types?: DepType[] | (readonly DepType[]), maxDepth?: number };

const DEP_MAPPING = {
  prod: 'dependencies',
  dev: 'devDependencies',
  opt: 'optionalDependencies',
  peer: 'peerDependencies',
} as const;

type PackageShape = {
  name: string;
} & {
  [key: string]: {
    [key: string]: string;
  };
};

/**
 * Utilities for processing the package.json dependencies
 */
export class DependenciesUtil {

  /**
   * Find the dependency's package.json file
   * @param dep
   * @param root
   */
  static resolveDependencyPackageJson(dep: string, root: string): string {
    const paths = [root, ...(require.resolve.paths(root) || [])];
    let folder: string;
    try {
      folder = require.resolve(`${dep}/package.json`, { paths });
      folder = path.dirname(path.resolve(root, folder).__posix);
    } catch {
      folder = require.resolve(dep, { paths });
      folder = path.dirname(path.resolve(root, folder).__posix);
      while (!existsSync(`${folder}/package.json`)) {
        const next = path.dirname(folder);
        if (folder === next) {
          throw new Error(`Unable to resolve dependency: ${dep}`);
        }
        folder = next;
      }
    }
    return folder;
  }

  /**
   * Get list of all production dependencies and their folders, for a given package
   */
  static async resolveDependencies({
    root = process.cwd().__posix,
    types = ['prod'],
    maxDepth = Number.MAX_SAFE_INTEGER
  }: DepResolveConfig): Promise<ResolvedDep[]> {
    const pending: [string, number][] = [[root, 0]];
    const foundSet = new Set<string>();
    const found: ResolvedDep[] = [];
    while (pending.length) {
      const [top, depth] = pending.shift()!;
      if (depth > maxDepth) { // Ignore if greater than valid max depth
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const p = await import(`${top}/package.json`) as PackageShape;
      const deps: (readonly [name: string, type: DepType, version: string])[] = [];
      for (const type of types) {
        if (
          type !== 'dev' ||
          maxDepth === 0
        ) {
          deps.push(...Object
            .entries<Record<string, string>>(p[DEP_MAPPING[type]] ?? {})
            .map(([name, version]) => [name, type, version] as const)
          );
        }
      }
      for (const [dep, type, version] of deps) {
        try {
          const resolved = this.resolveDependencyPackageJson(dep, top);

          if (!foundSet.has(resolved)) {
            foundSet.add(resolved);
            found.push({ file: resolved, type, dep, version });
            pending.push([resolved, depth + 1]);
          }
        } catch {
          if (!dep.startsWith('@types') && type !== 'opt' && type !== 'peer') {
            console.error('Unable to resolve', { type, dependency: dep });
          }
        }
      }
    }
    return found;
  }
}