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
function $getCreateRequire() {
  try { return require('module').createRequire; }
  catch { return import('module').then(x => x.Module.createRequire); }
}

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

const WS_ROOT = {};

/**
 * Get workspace root
 * @return {Promise<string>}
 */
async function $getWorkspaceRoot(base = process.cwd()) {
  if (base in WS_ROOT) {
    return WS_ROOT[base];
  }

  const path = await $getPath();
  const fs = await $getFs();
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
async function getManifestContext(folder) {
  const path = await $getPath();
  const workspacePath = path.resolve(await $getWorkspaceRoot(folder));

  // If manifest specified via env var, and is a package name
  if (!folder && process.env.TRV_MODULE) {
    const createRequire = await $getCreateRequire();
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

  return {
    moduleType,
    mainModule,
    mainOutputFolder: `${outputFolder}/node_modules/${mainModule}`,
    mainPath,
    workspacePath,
    monoRepo,
    outputFolder,
    compilerFolder: '.trv_compiler'
  };
}


module.exports = { getManifestContext };