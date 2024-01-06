// @ts-check

/**
 * @typedef {import('../src/types').Package & { path:string }} Pkg
 * @typedef {Pkg & { mono: boolean, manager: 'yarn'|'npm', resolve: (file:string) => string}} Workspace
 * @typedef {import('../src/types').ManifestContext} ManifestContext
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/** @type {Record<string, Workspace>} */ const WS_ROOT = {};
const TOOL_FOLDER = '.trv/tool';
const COMPILER_FOLDER = '.trv/compiler';
const OUTPUT_FOLDER = '.trv/output';

/**
 * Read package.json or return undefined if missing
 * @param {string} dir
 * @returns {Pkg|undefined}
 */
function $readPackage(dir) {
  dir = dir.endsWith('.json') ? path.dirname(dir) : dir;
  try {
    const v = readFileSync(path.resolve(dir, 'package.json'), 'utf8');
    return ({ ...JSON.parse(v), path: path.resolve(dir) });
  } catch { }
}

/**
 * Find package.json for a given folder
 * @param {string} dir
 * @return {Pkg}
 */
function $findPackage(dir) {
  let prev;
  let pkg, curr = path.resolve(dir);
  while (!pkg && curr !== prev) {
    pkg = $readPackage(curr);
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
 * @return {Workspace}
 */
function $resolveWorkspace(base = process.cwd()) {
  if (base in WS_ROOT) { return WS_ROOT[base]; }
  let folder = base;
  let prev;
  /** @type {Pkg|undefined} */
  let prevPkg, pkg;

  while (prev !== folder) {
    [prev, prevPkg] = [folder, pkg];
    pkg = $readPackage(folder) ?? pkg;
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
    mono: !!pkg.workspaces || (!pkg.travetto?.build?.isolated && !!prevPkg)  // Workspaces or nested projects
  };
}

/**
 * Get Compiler url
 * @param {Workspace} ws
 */
function $getCompilerUrl(ws) {
  const file = path.resolve(ws.path, TOOL_FOLDER, 'build.compilerUrl');
  // eslint-disable-next-line no-bitwise
  const port = (Math.abs([...file].reduce((a, b) => (a * 33) ^ b.charCodeAt(0), 5381)) % 29000) + 20000;
  const out = `http://localhost:${port}`;
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, out, 'utf8');
  }
  return out;
}

/**
 * Resolve module folder
 * @param {Workspace} workspace
 * @param {string|undefined} folder
 */
function $resolveModule(workspace, folder) {
  let mod;
  if (!folder && process.env.TRV_MODULE) {
    mod = process.env.TRV_MODULE;
    if (/[.](t|j)sx?$/.test(mod)) { // Rewrite from file to module
      try {
        process.env.TRV_MODULE = mod = $findPackage(path.dirname(mod)).name;
      } catch {
        process.env.TRV_MODULE = mod = '';
      }
    }
  }

  if (mod) { // If module provided in lieu of folder
    try {
      folder = path.dirname(workspace.resolve(`${mod}/package.json`));
    } catch {
      const workspacePkg = $readPackage(workspace.path);
      if (workspacePkg?.name === mod) {
        folder = workspace.path;
      } else {
        throw new Error(`Unable to resolve location for ${folder}`);
      }
    }
  }

  return $findPackage(folder ?? '.');
}

/**
 * Gets build context
 * @param {string} [folder]
 * @return {ManifestContext}
 */
export function getManifestContext(folder) {
  const workspace = $resolveWorkspace(folder);
  const mod = $resolveModule(workspace, folder);
  const build = workspace.travetto?.build ?? {};

  return {
    workspace: {
      name: workspace.name,
      path: workspace.path,
      mono: workspace.mono,
      manager: workspace.manager,
      type: workspace.type ?? 'commonjs'
    },
    build: {
      compilerFolder: build.compilerFolder ?? COMPILER_FOLDER,
      compilerUrl: build.compilerUrl ?? $getCompilerUrl(workspace),
      compilerModuleFolder: path.dirname(workspace.resolve('@travetto/compiler/package.json')).replace(`${workspace.path}/`, ''),
      outputFolder: build.outputFolder ?? OUTPUT_FOLDER,
    },
    main: {
      name: mod.name ?? 'untitled',
      folder: mod.path === workspace.path ? '' : mod.path.replace(`${workspace.path}/`, ''),
      version: mod.version,
      description: mod.description
    }
  };
}