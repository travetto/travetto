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

  // If manifest specified via env var, and is a package name
  if (!folder && process.env.TRV_MODULE) {
    const req = createRequire(`${workspacePath}/node_modules`);
    try {
      folder = path.dirname(req.resolve(`${process.env.TRV_MODULE}/package.json`));
    } catch { }
  }

  const mainPath = path.resolve(folder ?? '.');
  const { name: mainModule, workspaces, travetto } = (await $getPkg(mainPath));
  const monoRepo = workspacePath !== mainPath || !!workspaces;
  const outputFolder = travetto?.outputFolder ?? '.trv_output';

  const moduleType = (await $getPkg(workspacePath)).type ?? 'commonjs';
  const mainFolder = mainPath === workspacePath ? '' : mainPath.replace(`${workspacePath}/`, '');

  return {
    moduleType,
    mainModule,
    mainFolder,
    workspacePath,
    monoRepo,
    outputFolder,
    compilerFolder: '.trv_compiler'
  };
}