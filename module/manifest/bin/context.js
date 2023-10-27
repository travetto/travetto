// @ts-check

/**
 * @typedef {import('../src/types').Package} Pkg
 * @typedef {import('../src/types').ManifestContext} ManifestContext
 */
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

function naiveHash(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Returns the package.json
 * @param {string} inputFolder
 * @returns {Promise<Pkg>}
 */
async function $getPkg(inputFolder) {
  if (!inputFolder.endsWith('.json')) {
    inputFolder = path.resolve(inputFolder, 'package.json');
  }
  return JSON.parse(await fs.readFile(inputFolder, 'utf8'));
}

const WS_ROOT = {};

/**
 * Get module root for a given folder
 * @param {string} dir
 * @return {Promise<string>}
 */
async function $getModuleRoot(dir) {
  let prev;
  while (dir !== prev && !(await fs.stat(path.resolve(dir, 'package.json')).catch(() => false))) {
    prev = dir;
    dir = path.dirname(dir);
  }
  return dir;
}


/**
 * Get module name from a given file
 * @param {string} file
 * @return {Promise<string|void>}
 */
async function $getModuleFromFile(file) {
  return $getPkg(await $getModuleRoot(path.dirname(file))).then(v => v.name, () => { });
}

/**
 * Get workspace root
 * @return {Promise<string>}
 */
async function $getWorkspaceRoot(base = process.cwd()) {
  if (base in WS_ROOT) {
    return WS_ROOT[base];
  }

  let folder = base;
  let prevFolder = '';
  while (folder !== prevFolder) {
    try {
      const pkg = await $getPkg(folder);
      if (!!pkg.workspaces || !!pkg.travetto?.isolated) {
        return (WS_ROOT[base] = folder);
      }
    } catch { }
    if (await fs.stat(path.resolve(folder, '.git')).catch(() => { })) {
      break;
    }
    prevFolder = folder;
    folder = path.dirname(folder);
  }
  return WS_ROOT[base] = base;
}

/**
 * Get Compiler port
 * @param {string} file
 * @param {string|undefined} provided
 */
async function $getCompilerUrl(file, provided) {
  let compilerUrl = provided;

  if (!compilerUrl) {
    const fileStat = await fs.stat(file).catch(() => undefined);
    if (!fileStat) {
      await fs.writeFile(file, `http://127.0.0.1:${(naiveHash(file) % 29000) + 20000}`, 'utf8');
    }
    compilerUrl = (await fs.readFile(file, 'utf8')).trim();
  }

  return compilerUrl;
}

/**
 * Gets build context
 * @param {string} [folder]
 * @return {Promise<ManifestContext>}
 */
export async function getManifestContext(folder) {
  const workspacePath = path.resolve(await $getWorkspaceRoot(folder));
  const req = createRequire(`${workspacePath}/node_modules`);

  // If manifest specified via env var, and is a package name
  if (!folder && process.env.TRV_MODULE) {
    // If module is actually a file, try to detect
    if (/[.](t|j)s$/.test(process.env.TRV_MODULE)) {
      process.env.TRV_MODULE = await $getModuleFromFile(process.env.TRV_MODULE) ?? process.env.TRV_MODULE;
    }
    try {
      folder = path.dirname(req.resolve(`${process.env.TRV_MODULE}/package.json`));
    } catch {
      const workspacePkg = JSON.parse(await fs.readFile(path.resolve(workspacePath, 'package.json'), 'utf8'));
      if (workspacePkg.name === process.env.TRV_MODULE) {
        folder = workspacePath;
      } else {
        throw new Error(`Unable to resolve location for ${folder}`);
      }
    }
  }

  const mainPath = await $getModuleRoot(path.resolve(folder ?? '.'));
  const { name: mainModule, workspaces, travetto, version, description } = (await $getPkg(mainPath));
  const monoRepo = workspacePath !== mainPath || !!workspaces;
  const outputFolder = travetto?.outputFolder ?? '.trv_output';
  const toolFolder = '.trv_build';
  const compilerFolder = '.trv_compiler';
  const rootPkg = await $getPkg(workspacePath);

  const moduleType = rootPkg.type ?? 'commonjs';
  const mainFolder = mainPath === workspacePath ? '' : mainPath.replace(`${workspacePath}/`, '');
  /** @type {'yarn'|'npm'} */
  const packageManager = await fs.stat(path.resolve(workspacePath, 'yarn.lock')).then(() => 'yarn', () => 'npm');

  const { version: frameworkVersion } = JSON.parse(await fs.readFile(req.resolve('@travetto/manifest/package.json'), 'utf8'));

  const compilerUrl = await $getCompilerUrl(path.resolve(workspacePath, toolFolder, 'compiler.url'), rootPkg.travetto?.compilerUrl);

  const res = {
    moduleType,
    mainModule: mainModule ?? 'untitled', // When root package.json is missing a name
    mainFolder,
    workspacePath,
    monoRepo,
    outputFolder,
    toolFolder,
    compilerFolder,
    packageManager,
    version,
    description,
    compilerUrl,
    frameworkVersion
  };
  return res;
}