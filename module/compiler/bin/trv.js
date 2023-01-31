#!/usr/bin/env node

// @ts-check

/**
 * @param {import('@travetto/manifest').ManifestContext} ctx
 * @return {Promise<import('../support/bin/compiler-bootstrap')>}
 */
async function $getBootstrap(ctx) {
  const path = require('path');
  const { buildPackage } = require('./transpile');

  const root = path.resolve(__dirname, '..');

  const loc = await buildPackage(
    ctx, '__compiler_bootstrap__', root, 'support/bin/compiler-bootstrap.ts',
    ['support/bin/utils.ts', 'bin/transpile.js', 'package.json']
  );

  try { return require(loc); } catch { return import(loc); }
}

/**
 * @param {import('@travetto/manifest').ManifestContext} ctx
 * @param {boolean} [watch]
 */
const compile = (ctx, watch) => $getBootstrap(ctx).then(({ compile: go }) => go(ctx, watch));

/** @param {string[]} args */
async function exec(args) {
  const { getContext } = require('./transpile');
  const op = args.find(x => !x.startsWith('-'));
  /** @type {{clean?: boolean, quiet?: boolean}} */
  const flags = Object.fromEntries(args.filter(x => x.startsWith('-')).map(x => x.split('-').pop()).map(x => [x, true]));

  const ctx = await getContext();
  const message = flags.quiet ? () => { } : console.log.bind(console);

  // Clean if needed
  if (op === 'clean' || (op && flags.clean)) {
    const fs = require('fs/promises');
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
      const path = require('path/posix');
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