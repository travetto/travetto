import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { Package } from './types/package';
import type { ManifestContext } from './types/context';

type Pkg<T extends {} = {}> = Package & T & { path: string };
type PathOp = (file: string) => string;
type Workspace = Pkg<{
  mono: boolean;
  manager: 'yarn' | 'npm';
  resolve: PathOp;
  stripRoot: PathOp;
}>;

const TOOL_FOLDER = '.trv/tool';
const COMPILER_FOLDER = '.trv/compiler';
const OUTPUT_FOLDER = '.trv/output';
const TYPES_FOLDER = '.trv/types';

const WS_ROOT: Record<string, Workspace> = {};

/**
 * Read package.json or return undefined if missing
 */
function readPackage(dir: string): Pkg | undefined {
  dir = dir.endsWith('.json') ? path.dirname(dir) : dir;
  try {
    const v = readFileSync(path.resolve(dir, 'package.json'), 'utf8');
    return ({ ...JSON.parse(v), path: path.resolve(dir) });
  } catch { }
}

/**
 * Find package.json for a given folder
 */
function findPackage(dir: string): Pkg {
  let prev;
  let pkg, curr = path.resolve(dir);
  while (!pkg && curr !== prev) {
    pkg = readPackage(curr);
    [prev, curr] = [curr, path.dirname(curr)];
  }
  if (!pkg) {
    throw new Error('Could not find a package.json');
  } else {
    return pkg;
  }
}

/**
 * Get workspace root
 */
function resolveWorkspace(base: string = process.cwd()): Workspace {
  if (base in WS_ROOT) { return WS_ROOT[base]; }
  let folder = base;
  let prev;
  /** @type {Pkg|undefined} */
  let prevPkg, pkg;

  while (prev !== folder) {
    [prev, prevPkg] = [folder, pkg];
    pkg = readPackage(folder) ?? pkg;
    if (
      (pkg && (!!pkg.workspaces || !!pkg.travetto?.build?.isolated)) || // if we have a monorepo root, or we are isolated
      existsSync(path.resolve(folder, '.git')) // we made it to the source repo root
    ) {
      break;
    }
    folder = path.dirname(folder);
  }

  if (!pkg) {
    throw new Error('Could not find a package.json');
  }

  return WS_ROOT[base] = {
    ...pkg,
    name: pkg.name ?? 'untitled',
    type: pkg.type,
    manager: existsSync(path.resolve(pkg.path, 'yarn.lock')) ? 'yarn' : 'npm',
    resolve: createRequire(`${pkg.path}/node_modules`).resolve.bind(null),
    stripRoot: (full) => full === pkg.path ? '' : full.replace(`${pkg.path}/`, ''),
    mono: !!pkg.workspaces || (!pkg.travetto?.build?.isolated && !!prevPkg)  // Workspaces or nested projects
  };
}

/**
 * Get Compiler url
 */
function getCompilerUrl(ws: Workspace): string {
  // eslint-disable-next-line no-bitwise
  const port = (Math.abs([...ws.path].reduce((a, b) => (a * 33) ^ b.charCodeAt(0), 5381)) % 29000) + 20000;
  return `http://localhost:${port}`;
}

/**
 * Resolve module folder
 */
function resolveModule(workspace: Workspace, folder?: string): Pkg {
  let mod;
  if (!folder && process.env.TRV_MODULE) {
    mod = process.env.TRV_MODULE;
    if (/[.][cm]?(t|j)sx?$/.test(mod)) { // Rewrite from file to module
      try {
        process.env.TRV_MODULE = mod = findPackage(path.dirname(mod)).name;
      } catch {
        process.env.TRV_MODULE = mod = '';
      }
    }
  }

  if (mod) { // If module provided in lieu of folder
    try {
      folder = path.dirname(workspace.resolve(`${mod}/package.json`));
    } catch {
      const workspacePkg = readPackage(workspace.path);
      if (workspacePkg?.name === mod) {
        folder = workspace.path;
      } else {
        throw new Error(`Unable to resolve location for ${folder}`);
      }
    }
  }

  return findPackage(folder ?? '.');
}

/**
 * Gets build context
 */
export function getManifestContext(folder?: string): ManifestContext {
  const workspace = resolveWorkspace();
  const mod = resolveModule(workspace, folder);
  const build = workspace.travetto?.build ?? {};

  return {
    workspace: {
      name: workspace.name,
      path: workspace.path,
      mono: workspace.mono,
      manager: workspace.manager,
      type: workspace.type ?? 'commonjs',
      defaultEnv: workspace.travetto?.defaultEnv ?? 'local'
    },
    build: {
      compilerFolder: build.compilerFolder ?? COMPILER_FOLDER,
      compilerUrl: build.compilerUrl ?? getCompilerUrl(workspace),
      compilerModuleFolder: workspace.stripRoot(path.dirname(workspace.resolve('@travetto/compiler/package.json'))),
      outputFolder: build.outputFolder ?? OUTPUT_FOLDER,
      toolFolder: build.toolFolder ?? TOOL_FOLDER,
      typesFolder: build.typesFolder ?? TYPES_FOLDER
    },
    main: {
      name: mod.name ?? 'untitled',
      folder: workspace.stripRoot(mod.path),
      version: mod.version,
      description: mod.description
    }
  };
}