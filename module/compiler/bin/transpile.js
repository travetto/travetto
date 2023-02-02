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
 * Gets tsconfig file location
 * @param {ManifestContext} ctx
 * @return {Promise<string>}
 */
async function $getTsconfigFile(ctx) {
  const path = $getPath();
  const fs = $getFs();

  let tsconfig = path.resolve(ctx.workspacePath, 'tsconfig.json');

  if (!await fs.stat(tsconfig).then(_ => true, _ => false)) {
    const mod = await $getModule();
    const req = mod.createRequire(`${ctx.workspacePath}/node_modules`);
    tsconfig = req.resolve('@travetto/compiler/tsconfig.trv.json');
  }
  return tsconfig;
}

/**
 * Returns the compiler options
 * @param {ManifestContext} ctx
 */
async function getCompilerOptions(ctx) {
  if (!(ctx.workspacePath in _opts)) {
    const ts = await $getTs();

    const tsconfig = await $getTsconfigFile(ctx);

    const { options } = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(tsconfig, ts.sys.readFile), ts.sys, ctx.workspacePath
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
 * Output a file, support for ts, js, and package.json
 * @param {ManifestContext} ctx
 * @param {string} inputFile
 * @param {string} outputFile
 */
async function writeFile(ctx, inputFile, outputFile) {
  const fs = await $getFs();
  const path = await $getPath();
  const ts = await $getTs();
  const opts = await getCompilerOptions(ctx);
  const isEsm = opts.module !== ts.ModuleKind.CommonJS;

  await fs.mkdir(path.dirname(outputFile), { recursive: true });

  let content;

  if (inputFile.endsWith('.ts')) {
    content = ts.transpile(await fs.readFile(inputFile, 'utf8'), opts, inputFile)
      // Rewrite import/exports
      .replace(/^((?:im|ex)port .*from '[.][^']+)(')/mg, (_, a, b) => `${a}.js${b}`)
      .replace(/^(import [^\n]*from '[^.][^\n/]+[/][^\n/]+[/][^\n']+)(')/mg, (_, a, b) => `${a}.js${b}`);
  } else if (inputFile.endsWith('.js')) {
    content = await fs.readFile(inputFile, 'utf8');
    if (isEsm) {
      content = content
        .replace(/^(?:async )?function [^$]/mg, a => `export ${a}`)
        .replace(/^module.exports.*/mg, '');
    }
  } else if (inputFile.endsWith('package.json')) {
    const pkg = await $getPkg(inputFile);
    const main = pkg.main?.replace(/[.]ts$/, '.js');
    const type = isEsm ? 'module' : 'commonjs';
    const files = pkg.files?.map(x => x.replace('.ts', '.js'));
    content = JSON.stringify({ ...pkg, main, type, files }, null, 2);
  }
  if (content) {
    ts.sys.writeFile(outputFile, content);
  }
}

module.exports = { getCompilerOptions, writeFile };