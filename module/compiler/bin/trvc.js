#!/usr/bin/env node

// @ts-check
import fs from 'fs/promises';
import path from 'path';

import { withContext } from './common.js';

/** @typedef {import('@travetto/manifest/src/types').ManifestContext} Ctx */

const stop = async (/** @typedef {Ctx} */ ctx) => {
  if (await fetch(`${ctx.compilerUrl}/stop`).then(v => v.ok, () => false)) {
    console.log(`Stopped server ${ctx.workspacePath}: [${ctx.compilerUrl}]`);
  } else {
    console.log(`Server not running ${ctx.workspacePath}: [${ctx.compilerUrl}]`);
  }
};

const info = async (/** @typedef {Ctx} */ctx) => console.log(
  JSON.stringify(await fetch(ctx.compilerUrl).then(v => v.json(), () => undefined) ?? { state: 'Server not running' }, null, 2)
);

const clean = async (/** @typedef {Ctx} */ctx) => {
  const folders = [ctx.outputFolder, ctx.compilerFolder];
  if (await fetch(`${ctx.compilerUrl}/clean`).then(v => v.ok, () => false)) {
    return console.log(`Clean triggered ${ctx.workspacePath}:`, folders);
  } else {
    await Promise.all(folders.map(f => fs.rm(path.resolve(ctx.workspacePath, f), { force: true, recursive: true })));
    return console.log(`Cleaned ${ctx.workspacePath}:`, folders);
  }
};

const help = () => [
  'npx trvc [command]',
  '',
  'Available Commands:',
  ' * start|watch - Run the compiler in watch mode',
  ' * stop        - Stop the compiler if running',
  ' * restart     - Restart the compiler in watch mode',
  ' * build       - Ensure the project is built and upto date',
  ' * clean       - Clean out the output and compiler caches',
  ' * info        - Retrieve the compiler information, if running',
  ' * manifest    - Generate the project manifest',
].join('\n');

withContext(async (ctx, compile) => {
  const op = process.argv[2];

  switch (op) {
    case 'restart': return stop(ctx).then(() => compile(ctx, 'watch'));
    case 'stop': return stop(ctx);
    case 'info': return info(ctx);
    case 'clean': return clean(ctx);
    case 'watch':
    case 'start': return compile(ctx, 'watch');
    case 'build':
    case 'manifest': return compile(ctx, op);
    case undefined:
    case 'help': return console.log(`\n${help()}\n`);
    default: console.error(`Unknown trvc operation: ${op}\n`); return console.error(help());
  }
});