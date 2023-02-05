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
/**
 * @returns {{createRequire:(folder:string) => ({ resolve: (file:string)=>string})}}
 */
function $getModule() {
  try { return require('module'); }
  // @ts-expect-error
  catch { return import('module').then(x => x.default); }
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
async function getManifestContext(folder) {
  const path = await $getPath();
  const fs = await $getFs();

  folder ??= (process.env.TRV_MANIFEST || process.cwd());

  const workspacePath = path.resolve(await $getWorkspaceRoot());
  let mainPath = toPosix(folder);

  // If not a folder, try to treat as package
  if (!await fs.stat(path.resolve(mainPath)).catch(() => false)) {
    const mod = await $getModule();
    const req = mod.createRequire(`${workspacePath}/node_modules`);
    try {
      mainPath = path.dirname(req.resolve(`${folder}/package.json`));
    } catch { }
  }

  const { name: mainModule, workspaces, travetto } = (await $getPkg(mainPath));
  const monoRepo = workspacePath !== mainPath || !!workspaces;
  const outputFolder = process.env.TRV_OUTPUT_FOLDER ?? travetto?.outputFolder ?? '.trv_output';

  return {
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