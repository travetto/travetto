// @ts-check

const _opts = {};

/**
 * @typedef {import('@travetto/manifest').Package} Pkg
 * @typedef {import('@travetto/manifest').ManifestContext} ManifestContext
 */

function $imp(mod) {
  try { return require(mod); } catch { return import(mod).then(x => x.default); }
}

/** @type {() => import('typescript')} */
const $getTs = $imp.bind(null, 'typescript');
/** @type {() => import('fs/promises')} */
const $getFs = $imp.bind(null, 'fs/promises');
/** @type {() => import('path')} */
const $getPath = $imp.bind(null, 'path');
/** @type {() => ({createRequire:(folder:string) => ({ resolve: (file:string)=>string})})} */
const $getModule = $imp.bind(null, 'module');
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
  const top = process.cwd();
  let folder = top;
  const fs = await $getFs();
  const path = await $getPath();
  while (!(await fs.stat(`${folder}/.git`).catch(() => false))) {
    const nextFolder = path.dirname(folder);
    if (nextFolder === folder) {
      break;
    }
    folder = nextFolder;
  }
  if (await fs.stat(`${folder}/package.json`).catch(() => false)) {
    const pkg = await $getPkg(folder);
    if (!!pkg.travettoRepo) {
      return folder;
    }
  }
  return top;
}

/**
 * Returns the compiler options
 * @param {ManifestContext} ctx
 * @returns
 */
async function $getOpts(ctx) {
  if (!(ctx.workspacePath in _opts)) {
    const path = await $getPath();
    const fs = await $getFs();
    const ts = await $getTs();
    const mod = await $getModule();
    const req = mod.createRequire(`${ctx.workspacePath}/node_modules`);

    const framework = req.resolve('@travetto/compiler/tsconfig.trv.json');
    const self = path.resolve(ctx.workspacePath, 'tsconfig.json');
    const loc = (await fs.stat(self).catch(() => false)) ? self : framework;
    const { options } = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(loc, ts.sys.readFile), ts.sys, ctx.workspacePath
    );
    try {
      const { type } = await $getPkg(ctx.workspacePath);
      if (type) {
        options.module = type.toLowerCase() === 'commonjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext;
      }
    } catch { }

    _opts[ctx.workspacePath] = options;
  }
  return _opts[ctx.workspacePath];
}

/**
 * Writes a package json file
 * @param {ManifestContext} ctx
 * @param {string} inputFile
 * @param {string} outputFile
 * @param {(pkg:Pkg) => Pkg} transform
 */
async function writePackageJson(ctx, inputFile, outputFile, transform) {
  const opts = await $getOpts(ctx);
  const ts = await $getTs();
  const isEsm = opts.module !== ts.ModuleKind.CommonJS;
  let pkg = await $getPkg(inputFile);
  pkg = transform?.(pkg) ?? pkg;
  pkg.main = pkg.main?.replace(/[.]ts$/, '.js');
  pkg.type = isEsm ? 'module' : 'commonjs';
  pkg.files = pkg.files?.map(x => x.replace('.ts', '.js'));

  ts.sys.writeFile(outputFile, JSON.stringify(pkg, null, 2));
}

/**
 * Transpiles a file
 * @param {ManifestContext} ctx
 * @param {string} inputFile
 * @param {string} outputFile
 */
async function transpileFile(ctx, inputFile, outputFile) {
  const ts = await $getTs();
  const fs = await $getFs();

  const opts = await $getOpts(ctx);
  const content = ts.transpile(await fs.readFile(inputFile, 'utf8'), opts, inputFile)
    .replace(/^((?:im|ex)port .*from '[.][^']+)(')/mg, (_, a, b) => `${a}.js${b}`)
    .replace(/^(import [^\n]*from '[^.][^\n/]+[/][^\n/]+[/][^\n']+)(')/mg, (_, a, b) => `${a}.js${b}`);

  ts.sys.writeFile(outputFile, content);
}

/**
 * Writes a js file
 * @param {ManifestContext} ctx
 * @param {string} inputFile
 * @param {string} outputFile
 */
async function writeJsFile(ctx, inputFile, outputFile) {
  const ts = await $getTs();
  const fs = await $getFs();

  const opts = await $getOpts(ctx);
  const isEsm = opts.module !== ts.ModuleKind.CommonJS;

  let content = await fs.readFile(inputFile, 'utf8');
  if (isEsm) {
    content = content
      .replace(/^(?:async )?function [^$]/mg, a => `export ${a}`)
      .replace(/^module.exports.*/mg, '');
  }

  await fs.writeFile(outputFile, content, 'utf8');
}

/**
 * Gets build context
 * @return {Promise<ManifestContext>}
 */
async function getContext() {
  const path = await $getPath();

  const workspacePath = path.resolve(await $getWorkspaceRoot());
  const mainPath = toPosix(process.cwd());

  const { name: mainModule, travettoRepo } = (await $getPkg(mainPath));
  const monoRepo = workspacePath !== mainPath || !!travettoRepo;

  // All relative to workspacePath
  const manifestFile = monoRepo ? `node_modules/${mainModule}/manifest.json` : 'manifest.json';

  return {
    mainModule,
    mainPath,
    workspacePath,
    monoRepo,
    manifestFile,
    outputFolder: '.trv_output',
    compilerFolder: '.trv_compiler'
  };
}

module.exports = { transpileFile, writePackageJson, writeJsFile, getContext };