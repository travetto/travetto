// @ts-ignore
import * as Mod from 'module';
import * as path from 'path';

import { FsUtil } from './fs';
import { ScanFs } from './scan';
import { EnvUtil } from './env';

type Module = {
  loaded?: boolean;
  _load?(req: string, parent: Module): any;
  _resolveFilename?(req: string, parent: Module): string;
  _compile?(contents: string, file: string): any;
} & NodeJS.Module;

// eslint-disable-next-line @typescript-eslint/no-redeclare
const Module = Mod as unknown as Module;
type DepResolveConfig = { root?: string, types?: DepType[] | (readonly DepType[]), maxDepth?: number };

export type ResolvedDep = { file: string, type: DepType, dep: string, version: string };
export type DepType = 'prod' | 'dev' | 'opt' | 'peer' | 'optPeer';

const DEP_MAPPING = {
  prod: 'dependencies',
  dev: 'devDependencies',
  opt: 'optionalDependencies',
  peer: 'peerDependencies',
  optPeer: 'optionalPeerDependencies'
};

/**
 * Framework specific utilities
 */
export class FrameworkUtil {

  /**
  * Scan the framework for folder/files only the framework should care about
  * @param testFile The test to determine if a file is desired
  */
  static scan(testFile?: (x: string) => boolean, base = FsUtil.cwd) {
    const out = ScanFs.scanDirSync({
      testFile,
      testDir: x => // Ensure its a valid folder or module folder
        /^node_modules[/]?$/.test(x) ||  // Top level node_modules
        (/^node_modules\/@travetto/.test(x) && !/node_modules.*node_modules/.test(x)) || // Module file
        !x.includes('node_modules') // non module file
    }, base);

    // Load dynamic modules with mappings
    for (const [dep, pth] of EnvUtil.getDynamicModules()) {
      out.push(
        ...ScanFs.scanDirSync({
          testFile,
          testDir: x => !x.includes('node_modules'),
        }, pth)
          .map(d => {
            d.module = d.module.includes('node_modules') ?
              d.module : d.file.replace(pth, `node_modules/${dep}`);
            return d;
          })
      ); // Read from module
    }

    return out;
  }

  /**
   * Find the dependency's package.json file
   * @param dep
   * @param root
   */
  static resolveDependencyPackageJson(dep: string, root: string) {
    const paths = [root, ...(require.resolve.paths(root) || [])];
    let folder: string;
    try {
      folder = require.resolve(`${dep}/package.json`, { paths });
      folder = path.dirname(FsUtil.resolveUnix(root, folder));
    } catch {
      folder = require.resolve(dep, { paths });
      folder = path.dirname(FsUtil.resolveUnix(root, folder));
      while (!FsUtil.existsSync(`${folder}/package.json`)) {
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
  static resolveDependencies({
    root = FsUtil.cwd,
    types = ['prod'],
    maxDepth = Number.MAX_SAFE_INTEGER
  }: DepResolveConfig) {
    const pending = [[root, 0]] as [string, number][];
    const foundSet = new Set<string>();
    const found: ResolvedDep[] = [];
    while (pending.length) {
      const [top, depth] = pending.shift()!;
      if (depth > maxDepth) { // Ignore if greater than valid max depth
        continue;
      }
      const p = require(`${top}/package.json`) as Record<string, Record<string, string>> & { name: string };
      const deps = [] as (readonly [name: string, type: DepType, version: string])[];
      for (const type of types) {
        if (
          type !== 'dev' ||
          p.name.startsWith('@travetto') || // @line-if $TRV_DEV_ROOT
          maxDepth === 0
        ) {
          deps.push(...Object.entries(p[DEP_MAPPING[type]] ?? {}).map(([name, version]) => [name, type as DepType, version] as const));
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
        } catch (err) {
          if (!dep.startsWith('@types') && type !== 'opt' && type !== 'optPeer') {
            console.error('Unable to resolve', { type, dependency: dep });
          }
        }
      }
    }
    return found;
  }
}