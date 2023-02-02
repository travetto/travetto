#!/usr/bin/env node

// @ts-check

/** @typedef {import('@travetto/manifest').ManifestContext} ManifestContext */

function $imp(mod) {
  try { return require(mod); } catch { return import(mod).then(x => x.default); }
}

/** @type {() => import('fs/promises')} */
const $getFs = $imp.bind(null, 'fs/promises');
/** @type {() => import('path')} */
const $getPath = $imp.bind(null, 'path');
/** @type {() => import('path/posix')} */
const $getPathPosix = $imp.bind(null, 'path/posix');

/**
 * Get bootstrap
 * @param {ManifestContext} ctx
 * @return {Promise<import('../support/bin/compiler-bootstrap')>}
 */
async function $getBootstrap(ctx) {
  const path = await $getPath();
  const fs = await $getFs();
  /** @type {import('./transpile')} */
  const { writeFile } = await $imp('./transpile');

  const name = '__compiler_bootstrap__';
  const files = ['support/bin/compiler-bootstrap.ts', 'support/bin/utils.ts', 'bin/transpile.js']
    .map(x => ({ src: x, out: x.replace(/[.]ts$/, '.js') }));

  const main = files[0].out;
  const outputPath = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', name);

  for (const { src, out } of files) {
    const inputFile = path.resolve(__dirname, '..', src);
    const outputFile = path.resolve(outputPath, out);

    const [outStat, inStat] = await Promise.all([
      fs.stat(outputFile).catch(() => undefined),
      fs.stat(inputFile)
    ]);

    if (!outStat || (outStat.mtimeMs < inStat.mtimeMs)) {
      await writeFile(ctx, inputFile, outputFile);
    }
  }

  const pkg = path.resolve(outputPath, 'package.json');
  if (!await fs.stat(path.resolve(outputPath, 'package.json')).then(_ => true, _ => false)) {
    await fs.writeFile(pkg, JSON.stringify({ name, main }), 'utf8');
  }

  return $imp(path.resolve(outputPath, main));
}

/**
 * @param {import('@travetto/manifest').ManifestContext} ctx
 * @param {boolean} [watch]
 */
const compile = (ctx, watch) => $getBootstrap(ctx).then(({ compile: go }) => go(ctx, watch));

/** @param {string[]} args */
async function exec(args) {
  const op = args.find(x => !x.startsWith('-'));
  /** @type {{clean?: boolean, quiet?: boolean}} */
  const flags = Object.fromEntries(args.filter(x => x.startsWith('-')).map(x => x.split('-').pop()).map(x => [x, true]));

  const { getManifestContext } = require('@travetto/manifest/bin/context');
  const ctx = await getManifestContext();
  const message = flags.quiet ? () => { } : console.log.bind(console);

  // Clean if needed
  if (op === 'clean' || (op && flags.clean)) {
    const fs = await $getFs();
    await Promise.all([ctx.outputFolder, ctx.compilerFolder].map(folder =>
      fs.rm(`${ctx.workspacePath}/${folder}`, { force: true, recursive: true })));
    if (op === 'clean') {
      message(`Cleaned ${ctx.workspacePath}: [${ctx.outputFolder}, ${ctx.compilerFolder}]`);
    }
  }

  switch (op) {
    case 'clean': break;
    case 'manifest': {
      const { writeManifest, buildManifest } = await $getBootstrap(ctx);
      const manifest = (await buildManifest(ctx)).manifest;
      await writeManifest(ctx, manifest);
      const output = `${ctx.workspacePath}/${ctx.outputFolder}/${ctx.manifestFile}`;
      message(`Wrote manifest ${output}`);
      break;
    }
    case 'watch':
      message(`Watching ${ctx.workspacePath} for changes...`);
      await compile(ctx, true);
      return;
    case 'build':
      await compile(ctx);
      message(`Built to ${ctx.workspacePath}/${ctx.outputFolder}`);
      break;
    default: {
      const path = await $getPathPosix();
      const { manifest } = await compile(ctx);
      const out = path.join(ctx.workspacePath, ctx.outputFolder);
      // TODO: Externalize somehow?
      const cliMain = path.join(out, manifest.modules['@travetto/cli'].output, 'support', 'cli.js');
      process.env.TRV_MANIFEST = ctx.mainModule;
      process.env.TRV_OUTPUT = out;
      await import(cliMain);
      return;
    }
  }
}

exec(process.argv.slice(2));