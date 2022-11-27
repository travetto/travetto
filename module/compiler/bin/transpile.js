// @ts-check

const _opts = {};

/**
 * @typedef {import('./transpile').Pkg} Pkg
 * @typedef {import('./transpile').CompileContext} CompileContext
 */

function $imp(mod) {
  try { return require(mod); } catch { return import(mod).then(x => x.default); }
}

/** @type {() => import('typescript')} */
const $getTs = $imp.bind(null, 'typescript');
/** @type {() => import('fs/promises')} */
const $getFs = $imp.bind(null, 'fs/promises');
/** @type {() => ({resolve:(file:string, ...rest:string[])=>string})} */
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
 * Returns the compiler options
 * @param {CompileContext} ctx
 * @returns
 */
async function $getOpts(ctx) {
  if (!(ctx.cwd in _opts)) {
    const path = await $getPath();
    const fs = await $getFs();
    const ts = await $getTs();
    const mod = await $getModule();
    const req = mod.createRequire(`${ctx.cwd}/node_modules`);

    const framework = req.resolve('@travetto/compiler/tsconfig.trv.json');
    const self = path.resolve(ctx.cwd, 'tsconfig.json');
    const loc = (await fs.stat(self).catch(() => false)) ? self : framework;
    const { options } = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(loc, ts.sys.readFile), ts.sys, ctx.cwd
    );
    try {
      const { type } = await $getPkg(ctx.cwd);
      if (type) {
        options.module = type.toLowerCase() === 'commonjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext;
      }
    } catch { }

    _opts[ctx.cwd] = options;
  }
  return _opts[ctx.cwd];
}

/**
 * Writes a package json file
 * @param {CompileContext} ctx
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
 * @param {CompileContext} ctx
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
 * @param {CompileContext} ctx
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
 * @param {CompileContext['op']} [op]
 * @return {Promise<CompileContext>}
 */
async function getContext(op = 'build') {
  const path = await $getPath();

  try { require(path.resolve('.env')); } catch { }
  const cwd = toPosix(process.cwd());
  const pkg = require(`${cwd}/package.json`);
  const compiled = /^(1|yes|on|true)$/i.test(process.env.TRV_COMPILED ?? '') ||
    process.env.TRV_OUTPUT === cwd;
  const outputFolder = process.env.TRV_OUTPUT || toPosix(path.resolve('.trv_output'));
  const compilerFolder = process.env.TRV_COMPILER || toPosix(path.resolve('.trv_compiler'));
  return { compiled, outputFolder, compilerFolder, op, cwd, main: pkg.name };
}

module.exports = { transpileFile, writePackageJson, writeJsFile, getContext };