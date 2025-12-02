// @ts-check
/* eslint-disable no-undef */
const { stat, readFile, writeFile, mkdir, rm, readdir } = require('node:fs/promises');
const path = require('node:path');

const COMP_MOD = '@travetto/compiler';
const SOURCE_EXT_RE = /[.][cm]?[tj]sx?$/;
const BARE_IMPORT_RE = /^(@[^/]+[/])?[^.][^@/]+$/;
const OUTPUT_EXT = '.js';

async function writeIfStale(src = '', dest = '', transform = async (x = '') => x) {
  const [srcStat, destStat] = await Promise.all([src, dest].map(x => stat(`${x}`).then(z => z.mtimeMs, () => 0)));

  if (!destStat || destStat < srcStat) {
    const text = src ? await readFile(src, 'utf8') : '';
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, await transform(text), 'utf8');
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
  const ctx = await import(ctxDest).then((/** @type {import('@travetto/manifest')} */ v) => v.getManifestContext());

  const srcPath = path.resolve.bind(path, ctx.workspace.path, ctx.build.compilerModuleFolder);
  const destPath = (file = '') =>
    path.resolve(ctx.workspace.path, ctx.build.compilerFolder, 'node_modules', file).replace(SOURCE_EXT_RE, OUTPUT_EXT);

  return {
    packageType: ctx.workspace.type,
    srcPath,
    destPath,
    tsconfig: path.resolve(ctx.workspace.path, 'tsconfig.json'),
    cleanImports: (t = '') => t
      .replace(/from ['"]((@travetto|[.]+)[^'"]+)['"]/g, (_, v, m) => {
        const s = (m === '@travetto' ? destPath(v) : v).replace(SOURCE_EXT_RE, OUTPUT_EXT);
        const suf = s.endsWith(OUTPUT_EXT) ? '' : (BARE_IMPORT_RE.test(v) ? `/__index__${OUTPUT_EXT}` : OUTPUT_EXT);
        return `from '${s}${suf}'`;
      }),
    loadMain: () => import(destPath(`${COMP_MOD}/support/entry.main.ts`))
      .then((/** @type {import('../support/entry.main.ts')} */ v) => v.main(ctx)),
    supportFiles: () => readdir(srcPath('support'), { recursive: true, encoding: 'utf8' })
      .then(v => v.filter(f => f.endsWith('.ts')).map(j => `support/${j}`))
  };
}

/** @template T */
async function load(/** @type {(operations: import('../support/entry.main.ts').Operations) => T} */ cb) {
  const ctx = await getContext();

  try {
    await writeIfStale('', ctx.tsconfig,
      async () => JSON.stringify({ extends: `${COMP_MOD}/tsconfig.trv.json` }, null, 2));

    await writeIfStale(ctx.srcPath('package.json'), ctx.destPath(`${COMP_MOD}/package.json`),
      async text => JSON.stringify({ ...JSON.parse(text || '{}'), type: ctx.packageType }, null, 2));

    await Promise.all((await ctx.supportFiles()).map(f =>
      writeIfStale(ctx.srcPath(f), ctx.destPath(`${COMP_MOD}/${f}`),
        t => transpile(ctx.cleanImports(t), ctx.packageType === 'module'))));

    process.setSourceMapsEnabled(true); // Ensure source map during compilation/development
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --enable-source-maps`; // Ensure it passes to children
    const result = await ctx.loadMain();
    // @ts-ignore
    try { module.enableCompileCache(); } catch { }
    return cb(result);
  } catch (error) {
    await rm(ctx.destPath(COMP_MOD), { recursive: true, force: true });
    throw error;
  }
}

module.exports = { load };