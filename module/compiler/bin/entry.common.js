// @ts-check
/* eslint-disable no-undef */
const { stat, readFile, writeFile, mkdir, rm, readdir } = require('node:fs/promises');
const path = require('node:path');

const COMP_MOD = '@travetto/compiler';
const SOURCE_EXT_RE = /[.][cm]?[tj]sx?$/;
const BARE_IMPORT_RE = /^(@[^/]+[/])?[^.][^@/]+$/;
const OUTPUT_EXT = '.js';

async function writeIfStale(sourceFile = '', destinationFile = '', transform = async (text = '') => text) {
  const [srcStat, destStat] = await Promise.all([sourceFile, destinationFile].map(file => stat(`${file}`).then(stats => stats.mtimeMs, () => 0)));

  if (!destStat || destStat < srcStat) {
    const text = sourceFile ? await readFile(sourceFile, 'utf8') : '';
    await mkdir(path.dirname(destinationFile), { recursive: true });
    await writeFile(destinationFile, await transform(text), 'utf8');
  }
}

async function transpile(content = '', esm = true, full = true) {
  const ts = (await import('typescript')).default;
  return ts.transpile(content, {
    target: ts.ScriptTarget.ES2022,
    module: esm ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS,
    importHelpers: true,
    sourceMap: false,
    inlineSourceMap: true,
    allowImportingTsExtensions: true,
    ...(full ? { esModuleInterop: true, allowSyntheticDefaultImports: true } : {})
  });
}

async function getContext() {
  const ctxSrc = require.resolve('@travetto/manifest/src/context.ts');
  const ctxDest = path.resolve(__dirname, 'gen.context.mjs');
  await writeIfStale(ctxSrc, ctxDest, content => transpile(content, true, false));
  const ctx = await import(ctxDest).then((/** @type {import('@travetto/manifest')} */ value) => value.getManifestContext());

  const srcPath = path.resolve.bind(path, ctx.workspace.path, ctx.build.compilerModuleFolder);
  const destPath = (file = '') =>
    path.resolve(ctx.workspace.path, ctx.build.compilerFolder, 'node_modules', file).replace(SOURCE_EXT_RE, OUTPUT_EXT);

  return {
    packageType: ctx.workspace.type,
    srcPath,
    destPath,
    tsconfig: path.resolve(ctx.workspace.path, 'tsconfig.json'),
    cleanImports: (text = '') => text
      .replace(/from ['"]((@travetto|[.]+)[^'"]+)['"]/g, (_, location, module) => {
        const root = (module === '@travetto' ? destPath(location) : location).replace(SOURCE_EXT_RE, OUTPUT_EXT);
        const suffix = root.endsWith(OUTPUT_EXT) ? '' : (BARE_IMPORT_RE.test(location) ? `/__index__${OUTPUT_EXT}` : OUTPUT_EXT);
        return `from '${root}${suffix}'`;
      }),
    loadMain: () => import(destPath(`${COMP_MOD}/support/entry.main.ts`))
      .then((/** @type {import('../support/entry.main.ts')} */  value) => value.main(ctx)),
    supportFiles: () => readdir(srcPath('support'), { recursive: true, encoding: 'utf8' })
      .then(files => files.filter(file => file.endsWith('.ts')).map(file => `support/${file}`))
  };
}

/** @template T */
async function load(/** @type {(operations: import('../support/entry.main.ts').Operations) => T} */ callback) {
  const ctx = await getContext();

  try {
    await writeIfStale('', ctx.tsconfig,
      async () => JSON.stringify({ extends: `${COMP_MOD}/tsconfig.trv.json` }, null, 2));

    await writeIfStale(ctx.srcPath('package.json'), ctx.destPath(`${COMP_MOD}/package.json`),
      async text => JSON.stringify({ ...JSON.parse(text || '{}'), type: ctx.packageType }, null, 2));

    await Promise.all((await ctx.supportFiles()).map(file =>
      writeIfStale(ctx.srcPath(file), ctx.destPath(`${COMP_MOD}/${file}`),
        text => transpile(ctx.cleanImports(text), ctx.packageType === 'module'))));

    process.setSourceMapsEnabled(true); // Ensure source map during compilation/development
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --enable-source-maps`; // Ensure it passes to children
    const result = await ctx.loadMain();
    // @ts-ignore
    try { module.enableCompileCache(); } catch { }
    return callback(result);
  } catch (error) {
    await rm(ctx.destPath(COMP_MOD), { recursive: true, force: true });
    throw error;
  }
}

module.exports = { load };