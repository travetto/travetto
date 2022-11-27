#!/usr/bin/env node

// @ts-check

const fs = require('fs/promises');
const path = require('path');
const { createRequire } = require('module');

const { transpileFile, writePackageJson, writeJsFile, getContext } = require('./transpile');

const NAME = '@travetto/precompiler';
const FILES = ['support/bin/compile.ts', 'support/bin/utils.ts', 'bin/transpile.js', 'package.json'];

/**
 * @typedef {import('./transpile').CompileContext} CompileContext
 */

/**
 * @param {CompileContext} ctx
 */
async function $compile(ctx) {
  if (ctx.compiled) {
    return;
  }

  const root = path.resolve(__dirname, '..');

  const output = path.resolve(ctx.compilerFolder, `node_modules/${NAME}`);

  for (const el of FILES) {
    const inputFile = path.resolve(root, el);
    const outputFile = path.resolve(output, el.replace(/[.]ts$/, '.js'));

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
          pkg.files = FILES;
          pkg.name = NAME;
          pkg.main = FILES[0].replace(/[.]ts$/, '.js');
          return pkg;
        });
      }
    }
  }

  const loc = `${ctx.compilerFolder}/node_modules/${NAME}/${FILES[0].replace(/[.]ts$/, '.js')}`;
  /** @type {import('../support/bin/compile')} */
  let mod;
  try {
    mod = require(loc);
  } catch {
    mod = await import(loc);
  }
  return mod.compile(ctx);
}

/**
 *
 * @param {CompileContext} ctx
 */
async function $clean(ctx) {
  if (!ctx.compiled) {
    await fs.rm(ctx.outputFolder, { force: true, recursive: true });
    await fs.rm(ctx.compilerFolder, { force: true, recursive: true });
    console.log(`Cleaned ${ctx.cwd}`);
  }
}

/**
 * @param {CompileContext['op']} op
 * @param {string} [main]
 * @return {Promise<string|undefined>}
 */
async function exec(op, main) {
  const ctx = await getContext(op);
  switch (ctx.op) {
    case 'clean': await $clean(ctx); break;
    case 'watch': await $compile(ctx); break;
    default: {
      await $compile(ctx);
      if (main && !main.startsWith('/')) {
        const req = createRequire(`${ctx.outputFolder}/node_modules`);
        main = req.resolve(main);
      }
      return main;
    }
  }
}

module.exports = { exec };