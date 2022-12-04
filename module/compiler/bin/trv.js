#!/usr/bin/env node

// @ts-check

const fs = require('fs/promises');
const path = require('path');
const { createRequire } = require('module');

const { transpileFile, writePackageJson, writeJsFile, getContext } = require('./transpile');

const NAME = '@travetto/precompiler';
const FILES = ['support/bin/compiler-bootstrap.ts', 'support/bin/utils.ts', 'bin/transpile.js', 'package.json'];
const OUT_FILES = FILES.map(x => x.replace(/[.]ts$/, '.js'));
/** @typedef {import('./transpile').CompileCommand} CompileCommand */

/** @type {CompileCommand[]} */
const COMMANDS = ['build', 'clean', 'watch', 'manifest', 'main', 'default'];

const CMD_MAPPING = Object.fromEntries(COMMANDS.map(x => [x, x]));

/**
 * @typedef {import('@travetto/manifest').ManifestContext} ManifestContext
 */

/**
 * @param {ManifestContext} ctx
 * @return {Promise<import('../support/bin/compiler-bootstrap')>}
 */
async function $getBootstrap(ctx) {
  const root = path.resolve(__dirname, '..');

  const precompiler = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', NAME);

  for (const el of FILES) {
    const inputFile = path.resolve(root, el);
    const outputFile = path.resolve(precompiler, el.replace(/[.]ts$/, '.js'));

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
        await writePackageJson(ctx, inputFile, outputFile, (pkg) => {
          pkg.files = OUT_FILES;
          pkg.name = NAME;
          pkg.main = FILES[0].replace(/[.]ts$/, '.js');
          return pkg;
        });
      }
    }
  }

  const loc = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', NAME, OUT_FILES[0]);
  /** @type {import('../support/bin/compiler-bootstrap')} */
  let bootstrap;
  try {
    bootstrap = require(loc);
  } catch {
    bootstrap = await import(loc);
  }
  return bootstrap;
}

/**
 * @param {import('./transpile').CompileCommand} op
 * @param {string} [main]
 * @return {Promise<string|undefined>}
 */
async function exec(op, main) {
  const ctx = await getContext();
  switch (op) {
    case 'clean': {
      await fs.rm(path.resolve(ctx.workspacePath, ctx.outputFolder), { force: true, recursive: true });
      await fs.rm(path.resolve(ctx.workspacePath, ctx.compilerFolder), { force: true, recursive: true });
      console.log(`Cleaned ${ctx.workspacePath}: [${ctx.outputFolder}, ${ctx.compilerFolder}]`);
      break;
    }
    case 'manifest': {
      const bootstrap = await $getBootstrap(ctx);
      await bootstrap.writeManifest(
        ctx,
        await (await bootstrap.buildManifest(ctx)).manifest
      );
      console.log(`Wrote manifest ${path.resolve(ctx.workspacePath, ctx.outputFolder, ctx.manifestFile)}`);
      break;
    }
    case 'build':
    case 'watch': await (await $getBootstrap(ctx)).compile(ctx, op === 'watch'); break;
    case 'default':
      main = '@travetto/cli/support/main.cli.ts';
    // eslint-disable-next-line no-fallthrough
    case 'main':
      await (await $getBootstrap(ctx)).compile(ctx);
      main = (main ?? '').replace(/[.]ts$/, '.js');
      if (main && !main.startsWith('/')) {
        const req = createRequire(path.resolve(ctx.workspacePath, ctx.outputFolder, 'node_modules'));
        main = req.resolve(main);
      }
      process.env.TRV_MANIFEST = ctx.mainModule;
      process.env.TRV_OUTPUT = path.resolve(ctx.workspacePath, ctx.outputFolder);
      await import(process.env.TRV_MAIN = main);
      return;
  }
  process.exit(0);
}

exec(CMD_MAPPING[process.argv[2]] ?? 'default', process.argv[3]);