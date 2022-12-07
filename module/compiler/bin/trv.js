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
const compile = async (ctx, watch) => await (await $getBootstrap(ctx)).compile(ctx, watch);

/** @param {string} op */
async function exec(op) {
  const { getContext } = require('./transpile');

  const ctx = await getContext();
  switch (op) {
    case 'clean': {
      const fs = require('fs/promises');
      await fs.rm(`${ctx.workspacePath}/${ctx.outputFolder}`, { force: true, recursive: true });
      await fs.rm(`${ctx.workspacePath}/${ctx.compilerFolder}`, { force: true, recursive: true });
      console.log(`Cleaned ${ctx.workspacePath}: [${ctx.outputFolder}, ${ctx.compilerFolder}]`);
      return process.exit(0);
    }
    case 'manifest': {
      const { writeManifest, buildManifest } = await $getBootstrap(ctx);
      const manifest = (await buildManifest(ctx)).manifest;
      await writeManifest(ctx, manifest);
      console.log(`Wrote manifest ${ctx.workspacePath}/${ctx.outputFolder}/${ctx.manifestFile}`);
      return process.exit(0);
    }
    case 'watch':
      console.log(`Watching ${ctx.workspacePath} for changes...`);
      await compile(ctx, true);
      return;
    case 'build':
      await compile(ctx);
      console.log(`Built to ${ctx.workspacePath}/${ctx.outputFolder}`);
      return process.exit(0);
    default: {
      const path = require('path/posix');
      const { manifest } = await compile(ctx);
      const out = path.join(ctx.workspacePath, ctx.outputFolder);
      const cliMain = path.join(out, manifest.modules['@travetto/cli'].output, 'support', 'main.cli.js');
      process.env.TRV_MANIFEST = ctx.mainModule;
      process.env.TRV_OUTPUT = out;
      await import(process.env.TRV_MAIN = cliMain);
      return;
    }
  }
}

exec(process.argv[2]);