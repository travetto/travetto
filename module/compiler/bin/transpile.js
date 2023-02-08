// @ts-check

const _opts = {};

/**
 * @typedef {import('@travetto/manifest').Package} Pkg
 * @typedef {import('@travetto/manifest').ManifestContext} ManifestContext
 * @typedef {{ input: string, output: string, stale: boolean }} ModFile
 */

function $getTs() {
  try { return require('typescript'); }
  catch { return import('typescript').then(x => x.default); }
}
function $getFs() {
  try { return require('fs/promises'); }
  catch { return import('fs/promises').then(x => x.default); }
}
function $getPath() {
  try { return require('path'); }
  catch { return import('path').then(x => x.default); }
}
/**
 * @param {string} root
 */
function $createRequire(root) {
  try { return require('module').createRequire(root); }
  catch { return import('module').then(x => x.Module.createRequire(root)); }
}

const SOURCE_SEED = ['package.json', 'index.ts', '__index__.ts', 'src', 'support', 'bin'];
const IS_DEBUG = /\b([*]|build)\b/.test(process.env.DEBUG ?? '');
const PRECOMPILE_MODS = [
  '@travetto/terminal',
  '@travetto/manifest',
  '@travetto/transformer',
  '@travetto/compiler'
];

/**
 * Recent stat
 * @param {import('fs').Stats} stat
 * @returns {number}
 */
const $recentStat = stat => Math.max(stat.ctimeMs, stat.mtimeMs);

/**
 * Common logging support
 */
const log = IS_DEBUG ?
  (...args) => console.debug(new Date().toISOString(), ...args) :
  () => { };

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
  const path = await $getPath();
  const fs = await $getFs();

  let tsconfig = path.resolve(ctx.workspacePath, 'tsconfig.json');

  if (!await fs.stat(tsconfig).then(_ => true, _ => false)) {
    const req = await $createRequire(`${ctx.workspacePath}/node_modules`);
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
    const path = await $getPath();

    const tsconfig = await $getTsconfigFile(ctx);

    const { options } = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(tsconfig, ts.sys.readFile), ts.sys, ctx.workspacePath
    );

    options.allowJs = true;
    options.resolveJsonModule = true;
    options.sourceRoot = ctx.workspacePath;
    options.rootDir = ctx.workspacePath;
    options.outDir = path.resolve(ctx.workspacePath, ctx.outputFolder);

    try {
      const { type = 'commonjs' } = await $getPkg(ctx.workspacePath);
      options.moduleType = type.toLowerCase();
      options.module = type.toLowerCase() === 'commonjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext;
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
async function $writeFile(ctx, inputFile, outputFile) {
  const fs = await $getFs();
  const ts = await $getTs();
  const path = await $getPath();
  const opts = await getCompilerOptions(ctx);
  const isEsm = opts.module !== ts.ModuleKind.CommonJS;

  let content;

  if (inputFile.endsWith('.ts') || inputFile.endsWith('.js')) {
    const diags = [];
    const compilerOut = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules');
    const text = (await fs.readFile(inputFile, 'utf8'))
      .replace(/from '@travetto\//g, `from '${compilerOut}/@travetto/`);

    content = ts.transpile(text, opts, inputFile, diags)
      // Rewrite import/exports
      .replace(/^((?:im|ex)port .*from '[.][^']+)(')/mg, (_, a, b) => `${a}.js${b}`)
      .replace(/^(import [^\n]*from '[^.][^\n/]+[/][^\n/]+[/][^\n']+)(')/mg, (_, a, b) => `${a}.js${b}`);
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

/**
 * Scan directory to find all project sources for comparison
 * @param {ManifestContext} ctx
 * @param {string} module
 * @param {string[]} seed
 * @returns {Promise<ModFile[]>}
 */
async function getModuleSources(ctx, module, seed) {
  const path = await $getPath();
  const fs = await $getFs();

  const req = await $createRequire(`${process.cwd()}/node_modules`);

  const inputFolder = (ctx.mainModule === module) ?
    process.cwd() :
    path.dirname(req.resolve(`${module}/package.json`));

  const folders = seed.filter(x => !/[.]/.test(x)).map(x => path.resolve(inputFolder, x));
  const files = seed.filter(x => /[.]/.test(x)).map(x => path.resolve(inputFolder, x));

  while (folders.length) {
    const sub = folders.pop();
    if (!sub) {
      continue;
    }

    for (const file of await fs.readdir(sub).catch(() => [])) {
      if (file.startsWith('.')) {
        continue;
      }
      const resolvedInput = path.resolve(sub, file);
      const stat = await fs.stat(resolvedInput);

      if (stat.isDirectory()) {
        folders.push(resolvedInput);
      } else if (file.endsWith('.d.ts')) {
        // Do nothing
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        files.push(resolvedInput);
      }
    }
  }

  const outputFolder = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', module);
  /** @type  {ModFile[]} */
  const out = [];
  for (const input of files) {
    const output = input.replace(inputFolder, outputFolder).replace(/[.]ts$/, '.js');
    const inputTs = await fs.stat(input).then($recentStat, () => 0);
    if (inputTs) {
      const outputTs = await fs.stat(output).then($recentStat, () => 0);
      await fs.mkdir(path.dirname(output), { recursive: true, });
      out.push({ input, output, stale: inputTs > outputTs });
    }
  }

  return out;
}

/**
 * Recompile folder if stale
 * @param {ManifestContext} ctx
 * @param {string} prefix
 * @param {ModFile[]} files
 * @returns {Promise<void>}
 */
async function compileIfStale(ctx, prefix, files) {
  try {
    if (files.some(f => f.stale)) {
      log(`${prefix} Starting`);
      for (const file of files.filter(x => x.stale)) {
        await $writeFile(ctx, file.input, file.output);
      }
    } else {
      log(`${prefix} Skipped`);
    }
  } catch (err) {
    console.error(err);
  }
}

/**
 * Add output to node path
 * @param {ManifestContext} ctx
 */
async function addOutputToNodePath(ctx) {
  const path = await $getPath();
  const folder = path.resolve(ctx.workspacePath, ctx.outputFolder, 'node_modules');
  const og = process.env.NODE_PATH;
  process.env.NODE_PATH = [folder, og].join(path.delimiter);
  const { Module } = await import('module');
  // @ts-expect-error
  Module._initPaths();
  process.env.NODE_PATH = og; // Restore
}

/**
 * @param {ManifestContext} ctx
 */
async function precompile(ctx) {
  const fs = await $getFs();
  const path = await $getPath();

  /** @type {string[]} */
  const out = [];
  for (const mod of PRECOMPILE_MODS) {
    const files = await getModuleSources(ctx, mod, SOURCE_SEED);
    const changes = files.filter(x => x.stale).map(x => x.input);
    await compileIfStale(ctx, `[0] Compiling ${mod}`, files);
    if (changes.length) {
      out.push(...changes.map(x => `${mod}/${x}`));
      log(`[0] Compiler source changed ${mod}`, changes);
    }
  }
  if (out.length) {
    await fs.rm(path.resolve(ctx.workspacePath, ctx.outputFolder), { recursive: true, force: true });
    log('[0] Clearing output due to compiler source changes');
  }
}


/**
 * Get bootstrap
 * @param {ManifestContext} ctx
 * @return {Promise<import('../support/bin/bootstrap')>}
 */
async function getBootstrap(ctx) {
  await precompile(ctx);
  const path = await $getPath();
  const file = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', '@travetto/compiler/support/bin/bootstrap');
  try { return await import(file); }
  catch { return require(file); }
}


module.exports = { getCompilerOptions, precompile, log, addOutputToNodePath, compileIfStale, getModuleSources, getBootstrap };