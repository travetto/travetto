#!/usr/bin/env node

// @ts-check
const $getContext = async () => {
  try { return require('@travetto/manifest/bin/context'); }
  catch { return import('@travetto/manifest/bin/context').then(x => x.default); }
};
const $getFs = async () => {
  try { return require('fs/promises'); }
  catch { return import('fs/promises').then(x => x.default); }
};
const $getPath = async () => {
  try { return require('path'); }
  catch { return import('path').then(x => x.default); }
};
const $getModule = async () => {
  try { return require('module'); }
  catch { return import('module').then(x => x.default); }
};
const $getTs = async () => {
  try { return require('typescript'); }
  catch { return import('typescript'); }
};

const VALID_OPS = { watch: 'watch', build: 'build', clean: 'clean', manifest: 'manifest' };

/**
 * @param {import('@travetto/manifest').ManifestContext} ctx
 * @return {Promise<import('@travetto/compiler/support/launcher')>}
 */
const $getLauncher = async (ctx) => {
  const fs = await $getFs();
  const path = await $getPath();
  const compPkg = (await $getModule()).Module.createRequire(path.resolve('node_modules')).resolve('@travetto/compiler/package.json');
  const files = [];

  for (const file of ['support/launcher.js', 'support/transpile.js']) {
    const target = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', '@travetto/compiler', file);
    const src = compPkg.replace('package.json', file.replace(/[.]js$/, '.ts'));

    const targetTime = await fs.stat(target).then(s => Math.max(s.mtimeMs, s.ctimeMs)).catch(() => 0);
    const srcTime = await fs.stat(src).then(s => Math.max(s.mtimeMs, s.ctimeMs));
    // If stale
    if (srcTime > targetTime) {
      const ts = await $getTs();
      const module = ctx.moduleType === 'module' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS;
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, ts.transpile(await fs.readFile(src, 'utf8'), {
        target: ts.ScriptTarget.ES2020, module, esModuleInterop: true, allowSyntheticDefaultImports: true
      }), 'utf8');
      // Compile
    }
    files.push(target);
  }

  try { return await require(files[0]); }
  catch { return import(files[0]).then(x => x.default); }
};

/**
 * Parse arguments
 * @param {string[]} args
 * @returns {{ op?: keyof typeof VALID_OPS, clean?: boolean, quiet?: boolean, outputPath?: string, env?: string }}
 */
function parseArgs(args) {
  const op = VALID_OPS[args.find(x => !x.startsWith('-')) ?? ''];
  return {
    op,
    quiet: args.includes('--quiet') || args.includes('-q'),
    clean: args.includes('--clean') || args.includes('-c'),
    ...(op === 'manifest' ? { outputPath: args[1], env: args[2] } : {})
  };
}
const exec = async () => {
  const { getManifestContext } = await $getContext();
  const ctx = await getManifestContext();
  const { clean, compile, exportManifest } = await $getLauncher(ctx);
  const { op, outputPath, env, ...flags } = parseArgs(process.argv.slice(2));
  const message = flags.quiet ? () => { } : console.log.bind(console);

  // Clean if needed
  if (op === 'clean' || (op && flags.clean)) {
    await clean(ctx);
  }

  switch (op) {
    case 'clean': return message(`Cleaned ${ctx.workspacePath}: [${ctx.outputFolder}, ${ctx.compilerFolder}]`);
    case 'manifest': {
      const output = await exportManifest(ctx, outputPath ?? '', env);
      if (output) {
        message(`Wrote manifest ${output}`);
      }
      return;
    }
    case 'watch':
      message(`Watching ${ctx.workspacePath} for changes...`);
      return compile(ctx, true);
    case 'build':
      await compile(ctx);
      return message(`Built to ${ctx.workspacePath}/${ctx.outputFolder}`);
    default: {
      await compile(ctx);

      const path = await $getPath();
      const { Module } = await $getModule();

      // Rewriting node_path
      const folder = path.resolve(ctx.workspacePath, ctx.outputFolder, 'node_modules');
      const og = process.env.NODE_PATH;
      process.env.NODE_PATH = [folder, og].join(path.delimiter);
      // @ts-expect-error
      Module._initPaths();
      process.env.NODE_PATH = og; // Restore

      const out = path.join(ctx.workspacePath, ctx.outputFolder);
      process.env.TRV_THROW_ROOT_INDEX_ERR = '1';
      process.env.TRV_MANIFEST = path.resolve(ctx.workspacePath, ctx.mainOutputFolder);

      // TODO: Externalize somehow?
      const cliMain = path.join(out, 'node_modules/@travetto/cli/support/cli.js');
      await import(cliMain);
    }
  }
};

exec();