// @ts-check

/**
 * @typedef {import('../src/types').Package & { path:string }} Pkg
 * @typedef {Pkg & { mono: boolean, manager: 'yarn'|'npm', resolve: (file:string) => string}} Workspace
 * @typedef {import('../src/types').ManifestContext} ManifestContext
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

/** @type {Record<string, Workspace>} */ const WS_ROOT = {};
const TOOL_FOLDER = '.trv/tool';
const COMPILER_FOLDER = '.trv/compiler';
const OUTPUT_FOLDER = '.trv/output';

/**
 * Read package.json or return undefined if missing
 * @param {string} dir
 * @returns {Promise<Pkg|undefined>}
 */
async function $readPackage(dir) {
  dir = dir.endsWith('.json') ? path.dirname(dir) : dir;
  return await fs.readFile(path.resolve(dir, 'package.json'), 'utf8')
    .then(v => ({ ...JSON.parse(v), path: path.resolve(dir) }), () => undefined);
}

/**
 * Find package.json for a given folder
 * @param {string} dir
 * @return {Promise<Pkg>}
 */
async function $findPackage(dir) {
  let prev;
  let pkg, curr = path.resolve(dir);
  while (!pkg && curr !== prev) {
    pkg = await $readPackage(curr);
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
 * @return {Promise<Workspace>}
 */
async function $resolveWorkspace(base = process.cwd()) {
  if (base in WS_ROOT) { return WS_ROOT[base]; }
  let folder = base;
  let prev;
  /** @type {Pkg|undefined} */
  let prevPkg, pkg;

  while (prev !== folder) {
    [prev, prevPkg] = [folder, pkg];
    pkg = await $readPackage(folder) ?? pkg;
    if (
      (pkg && (!!pkg.workspaces || !!pkg.travetto?.build?.isolated)) || // if we have a monorepo root, or we are isolated
      await fs.stat(path.resolve(folder, '.git')).catch(() => { }) // we made it to the source repo root
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
    manager: await fs.stat(path.resolve(pkg.path, 'yarn.lock')).catch(() => { }) ? 'yarn' : 'npm',
    resolve: createRequire(`${pkg.path}/node_modules`).resolve.bind(null),
    mono: !!pkg.workspaces || (!pkg.travetto?.build?.isolated && !!prevPkg)  // Workspaces or nested projects
  };
}

/**
 * Get Compiler url
 * @param {Workspace} ws
 */
async function $getCompilerUrl(ws) {
  const file = path.resolve(ws.path, TOOL_FOLDER, 'build.compilerUrl');
  // eslint-disable-next-line no-bitwise
  const port = (Math.abs([...file].reduce((a, b) => (a * 33) ^ b.charCodeAt(0), 5381)) % 29000) + 20000;
  const out = `http://localhost:${port}`;
  try { await fs.stat(file); } catch {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, out, 'utf8');
  }
  return out;
}

/**
 * Resolve module folder
 * @param {Workspace} workspace
 * @param {string|undefined} folder
 */
async function $resolveModule(workspace, folder) {
  let mod;
  if (!folder && process.env.TRV_MODULE) {
    mod = process.env.TRV_MODULE;
    if (/[.](t|j)s$/.test(mod)) { // Rewrite from file to module
      process.env.TRV_MODULE = mod = await $findPackage(path.dirname(mod))
        .then(v => v.name, () => '');
    }
  }

  if (mod) { // If module provided in lieu of folder
    try {
      folder = path.dirname(workspace.resolve(`${mod}/package.json`));
    } catch {
      const workspacePkg = await $readPackage(workspace.path);
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
 * @return {Promise<ManifestContext>}
 */
export async function getManifestContext(folder) {
  const workspace = await $resolveWorkspace(folder);
  const mod = await $resolveModule(workspace, folder);
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
      compilerUrl: build.compilerUrl ?? await $getCompilerUrl(workspace),
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