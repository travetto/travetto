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
 * Returns the compiler options
 * @param {ManifestContext} ctx
 */
async function getCompilerOptions(ctx) {
  if (!(ctx.workspacePath in _opts)) {
    const ts = await $getTs();
    const path = await $getPath();

    const { options } = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(path.resolve(ctx.workspacePath, ctx.tsconfigFile), ts.sys.readFile), ts.sys, ctx.workspacePath
    );
    options.inlineSourceMap = true;
    options.sourceMap = false;
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
  const opts = await getCompilerOptions(ctx);
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

  const opts = await getCompilerOptions(ctx);
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

  const opts = await getCompilerOptions(ctx);
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
 * Write an entire package
 * @param {ManifestContext} ctx
 * @param {string} name
 * @param {string} sourcePath
 * @param {string} mainSource
 * @param {string[]} extraSources
 */
async function buildPackage(ctx, name, sourcePath, mainSource, extraSources) {
  const path = await $getPath();
  const fs = await $getFs();

  const files = [mainSource, ...extraSources].map(x => ({ src: x, out: x.replace(/[.]ts$/, '.js') }));
  const main = files[0].out;
  const outputPath = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', name);

  for (const { src, out } of files) {
    const inputFile = path.resolve(sourcePath, src);
    const outputFile = path.resolve(outputPath, out);

    const [outStat, inStat] = await Promise.all([
      fs.stat(outputFile).catch(() => undefined),
      fs.stat(inputFile)
    ]);

    if (!outStat || (outStat.mtimeMs < inStat.mtimeMs)) {
      await fs.mkdir(path.dirname(outputFile), { recursive: true });

      if (inputFile.endsWith('.ts')) {
        await transpileFile(ctx, inputFile, outputFile);
      } else if (inputFile.endsWith('.js')) {
        await writeJsFile(ctx, inputFile, outputFile);
      } else if (inputFile.endsWith('.json')) {
        await writePackageJson(ctx, inputFile, outputFile,
          (pkg) => ({ ...pkg, files: files.map(x => x.out), name, main }));
      }
    }
  }

  return path.resolve(outputPath, main);
}

/**
 * Gets build context
 * @return {Promise<ManifestContext>}
 */
async function getContext(folder = process.cwd()) {
  const path = await $getPath();

  const workspacePath = path.resolve(await $getWorkspaceRoot());
  const mainPath = toPosix(folder);

  const { name: mainModule, workspaces, travetto } = (await $getPkg(mainPath));
  const monoRepo = workspacePath !== mainPath || !!workspaces;

  // All relative to workspacePath
  const manifestFile = `node_modules/${mainModule}/manifest.json`;

  // Detect the desired tsconfig file
  const mod = await $getModule();
  const fs = await $getFs();
  const req = mod.createRequire(`${workspacePath}/node_modules`);
  const framework = req.resolve('@travetto/compiler/tsconfig.trv.json');
  const self = path.resolve(workspacePath, 'tsconfig.json');
  const tsconfigFile = ((await fs.stat(self).catch(() => false)) ? self : framework).replace(`${workspacePath}/`, '');

  return {
    mainModule,
    mainPath,
    workspacePath,
    monoRepo,
    manifestFile,
    outputFolder: travetto?.outputFolder ?? '.trv_output',
    compilerFolder: '.trv_compiler',
    tsconfigFile
  };
}

module.exports = { transpileFile, writePackageJson, writeJsFile, buildPackage, getCompilerOptions, getContext };