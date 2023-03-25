// @ts-check

/**
 * @typedef {import('../src/types').Package} Pkg
 * @typedef {import('../src/types').ManifestContext} ManifestContext
 */
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

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

  const moduleType = (await $getPkg(workspacePath)).type ?? 'commonjs';
  const mainFolder = mainPath === workspacePath ? '' : mainPath.replace(`${workspacePath}/`, '');
  /** @type {'yarn'|'npm'} */
  const packageManager = await fs.stat(path.resolve(workspacePath, 'yarn.lock')).then(() => 'yarn', () => 'npm');

  const { version: frameworkVersion } = JSON.parse(await fs.readFile(req.resolve('@travetto/manifest/package.json'), 'utf8'));

  const res = {
    moduleType,
    mainModule: mainModule ?? 'untitled', // When root package.json is missing a name
    mainFolder,
    workspacePath,
    monoRepo,
    outputFolder,
    toolFolder: '.trv_build',
    compilerFolder: '.trv_compiler',
    packageManager,
    version,
    description,
    frameworkVersion
  };
  return res;
}