#!/usr/bin/env node

// @ts-check

/** @typedef {import('@travetto/manifest').ManifestContext} ManifestContext */

const $getTranspile = async () => {
  try { return await require('./transpile'); }
  catch { return import('./transpile').then(x => x.default); }
};
const $getFs = () => {
  try { return require('fs/promises'); }
  catch { return import('fs/promises').then(x => x.default); }
};
const $getPath = () => {
  try { return require('path'); }
  catch { return import('path').then(x => x.default); }
};

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
    await fs.rm(`${ctx.workspacePath}/${ctx.outputFolder}`, { force: true, recursive: true });
    await fs.rm(`${ctx.workspacePath}/${ctx.compilerFolder}`, { force: true, recursive: true });
    if (op === 'clean') {
      message(`Cleaned ${ctx.workspacePath}: [${ctx.outputFolder}, ${ctx.compilerFolder}]`);
      return;
    }
  }

  const bootstrap = await $getTranspile().then(m => m.getBootstrap(ctx));

  switch (op) {
    case 'manifest': {
      const output = await bootstrap.createAndWriteManifest(ctx, args[1], args[2]);
      message(`Wrote manifest ${output}`);
      break;
    }
    case 'watch':
      message(`Watching ${ctx.workspacePath} for changes...`);
      await bootstrap.compile(ctx, true);
      return;
    case 'build':
      await bootstrap.compile(ctx);
      message(`Built to ${ctx.workspacePath}/${ctx.outputFolder}`);
      break;
    default: {
      await bootstrap.compile(ctx);

      const { addOutputToNodePath } = await $getTranspile();
      await addOutputToNodePath(ctx);

      const path = await $getPath();
      const out = path.join(ctx.workspacePath, ctx.outputFolder);
      // TODO: Externalize somehow?
      const cliMain = path.join(out, 'node_modules/@travetto/cli/support/cli.js');
      process.env.TRV_THROW_ROOT_INDEX_ERR = '1';
      process.env.TRV_MANIFEST = path.resolve(ctx.workspacePath, ctx.mainOutputFolder);
      await import(cliMain);
      return;
    }
  }
}

exec(process.argv.slice(2));