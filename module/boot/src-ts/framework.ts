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
} & Mod;

const Module = Mod as unknown as Module;
type DepResolveConfig = { root?: string, types?: DepType[] | (readonly DepType[]), maxDepth?: number };
type DepType = 'prod' | 'dev' | 'opt' | 'peer' | 'optPeer';

const DEP_MAPPING = {
  prod: 'dependencies',
  dev: 'devDependencies',
  opt: 'optionalDependencies',
  peer: 'peerDependencies',
  optPeer: 'optionalPeerDependencies'
};

// Pre installation of resolution rules
const pkg = (() => { try { return require(FsUtil.resolveUnix('package.json')); } catch { return {}; } })();

/**
 * Framework specific utilities
 */
export class FrameworkUtil {

  private static readonly devCache = {
    boot: FsUtil.resolveUnix(__dirname, '..'),
    [(pkg.name || '').split('/')[1]]: FsUtil.cwd // Initial
  };

  /**
   * Only called in Framework dev mode
   * @param pth The full path to translate
   * @param mod The module to check against
   */
  static resolveDev(p: string, mod?: Module) {
    let pth = p;
    if (mod) {
      try {
        pth = Module._resolveFilename!(pth, mod);
      } catch { }
    }

    pth = FsUtil.toUnix(pth);

    if (/travetto[^/]*\/module\/[^/]+\/bin/.test(pth) && !pth.startsWith(FsUtil.cwd)) { // Convert bin from framework module
      pth = `${FsUtil.cwd}/node_modules/@travetto/${pth.split(/\/module\//)[1]}`;
    }

    // If relative or framework
    if (pth.includes('@travetto')) {
      // Fetch current module's name
      // Handle self references
      pth = pth.replace(/^(.*\/?@travetto)\/([^/]+)(\/[^@]*)?$/g, (all, pre, name, rest) => {
        if (!(name in this.devCache)) {
          const base = `${FsUtil.cwd}/node_modules/@travetto/${name}`;
          this.devCache[name] = FsUtil.existsSync(base) ? base : `${pre}/${name}`;
        }
        return `${this.devCache[name]}${rest ? `/${rest}` : ''}`;
      })
        .replace(/\/\/+/g, '/'); // De-dupe
    }

    return pth;
  }

  /**
   * Standard path resolver
   */
  // eslint-disable-next-line @typescript-eslint/member-ordering
  static resolvePath = EnvUtil.isTrue('TRV_DEV') ?
    (a: string, b?: any) => FrameworkUtil.resolveDev(a, b) :
    (x: string) => x;

  /**
  * Scan the framework for folder/files only the framework should care about
  * @param testFile The test to determine if a file is desired
  */
  static scan(testFile?: (x: string) => boolean, base = FsUtil.cwd) {
    const matcher = new RegExp(`^node_modules\/(@travetto|${EnvUtil.getExtModules('!').map(x => x.replace(/\/.*$/, a => `(\\${a})?`)).join('|')})`);
    const out = ScanFs.scanDirSync({
      testFile,
      testDir: x => // Ensure its a valid folder or module folder
        /^node_modules[/]?$/.test(x) ||  // Top level node_modules
        (matcher.test(x) && !/node_modules.*node_modules/.test(x)) || // Module file
        !x.includes('node_modules'), // non module file
      resolvePath: this.resolvePath
    }, base);

    return out;
  }

  /**
   * Find the dependency's package.json file
   * @param dep
   * @param root
   */
  static async resolveDependencyPackageJson(dep: string, root: string) {
    const paths = [root, ...(require.resolve.paths(root) || [])];
    let folder: string;
    try {
      folder = require.resolve(`${dep}/package.json`, { paths });
      folder = path.dirname(FsUtil.resolveUnix(root, folder));
    } catch {
      folder = require.resolve(dep, { paths });
      folder = path.dirname(FsUtil.resolveUnix(root, folder));
      while (!(await FsUtil.exists(`${folder}/package.json`))) {
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
    root = FsUtil.cwd,
    types = ['prod'],
    maxDepth = Number.MAX_SAFE_INTEGER
  }: DepResolveConfig) {
    // Copy over prod node_modules
    const pending = [[root, 0]] as [string, number][];
    const foundSet = new Set<string>();
    const found: { file: string, type: DepType, dep: string, version: string }[] = [];
    while (pending.length) {
      const [top, depth] = pending.shift()!;
      if (depth > maxDepth) { // Ignore if greater than valid max depth
        continue;
      }
      const p = require(`${top}/package.json`) as Record<string, Record<string, string>> & { name: string };
      const deps = [] as (readonly [name: string, type: DepType, version: string])[];
      for (const type of types) {
        if (type !== 'dev' || (process.env.TRV_DEV && p.name.startsWith('@travetto')) || maxDepth === 0) {
          deps.push(...Object.entries(p[DEP_MAPPING[type]] ?? {}).map(([name, version]) => [name, type as DepType, version] as const));
        }
      }
      for (const [dep, type, version] of deps) {
        try {
          const resolved = this.resolvePath(await this.resolveDependencyPackageJson(dep, top));

          if (!foundSet.has(resolved)) {
            foundSet.add(resolved);
            found.push({ file: resolved, type, dep, version });
            pending.push([resolved, depth + 1]);
          }
        } catch (err) {
          if (!dep.startsWith('@types') && type !== 'opt' && type !== 'optPeer') {
            console.error('Unable to resolve', dep);
          }
        }
      }
    }
    return found;
  }
}