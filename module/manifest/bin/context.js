// @ts-check

/**
 * @typedef {import('../src/types').Package} Pkg
 * @typedef {import('../src/types').ManifestContext} ManifestContext
 */

function $getFs() {
  try { return require('fs/promises'); }
  catch { return import('fs/promises'); }
}
function $getPath() {
  try { return require('path'); }
  catch { return import('path'); }
}

/** @param {string} x */
const toPosix = x => x.replace(/\\/g, '/');

/**
 * Returns the package.json
 * @param {string} inputFolder
 * @returns {Promise<Pkg>}
 */
async function $getPkg(inputFolder) {
  const fs = await $getFs();
  const path = await $getPath();
  if (!inputFolder.endsWith('.json')) {
    inputFolder = path.resolve(inputFolder, 'package.json');
  }
  return JSON.parse(await fs.readFile(inputFolder, 'utf8'));
}

/**
 * Get workspace root
 * @return {Promise<string>}
 */
async function $getWorkspaceRoot() {
  const path = await $getPath();
  const fs = await $getFs();
  let folder = process.cwd();
  let prevFolder = '';
  while (folder !== prevFolder) {
    try {
      const pkg = await $getPkg(folder);
      if (!!pkg.workspaces || !!pkg.travetto?.isolated) {
        return folder;
      }
    } catch { }
    if (await fs.stat(path.resolve(folder, '.git')).catch(() => { })) {
      break;
    }
    prevFolder = folder;
    folder = path.dirname(folder);
  }
  return process.cwd();
}


/**
 * Gets build context
 * @return {Promise<ManifestContext>}
 */
async function getManifestContext(folder = process.cwd()) {
  const path = await $getPath();

  const workspacePath = path.resolve(await $getWorkspaceRoot());
  const mainPath = toPosix(folder);

  const { name: mainModule, workspaces, travetto } = (await $getPkg(mainPath));
  const monoRepo = workspacePath !== mainPath || !!workspaces;

  // All relative to workspacePath
  const manifestFile = `node_modules/${mainModule}/manifest.json`;

  return {
    mainModule,
    mainPath,
    workspacePath,
    monoRepo,
    manifestFile,
    outputFolder: travetto?.outputFolder ?? '.trv_output',
    compilerFolder: '.trv_compiler'
  };
}


module.exports = { getManifestContext };