#!/usr/bin/env node

// @ts-check
import fs from 'fs/promises';
import path from 'path';
import { Module, createRequire } from 'module';

import { getManifestContext } from '@travetto/manifest/bin/context.js';

const VALID_OPS = { watch: 'watch', build: 'build', clean: 'clean', manifest: 'manifest' };

/**
 * @param {import('@travetto/manifest').ManifestContext} ctx
 * @return {Promise<import('@travetto/compiler/support/launcher')>}
 */
const $getLauncher = async (ctx) => {
  const compPkg = createRequire(path.resolve('node_modules')).resolve('@travetto/compiler/package.json');
  const files = [];

  for (const file of ['support/launcher.js', 'support/transpile.js', 'package.json']) {
    const target = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', '@travetto/compiler', file);
    const src = compPkg.replace('package.json', file.replace(/[.]js$/, '.ts'));

    const targetTime = await fs.stat(target).then(s => Math.max(s.mtimeMs, s.ctimeMs)).catch(() => 0);
    const srcTime = await fs.stat(src).then(s => Math.max(s.mtimeMs, s.ctimeMs));
    // If stale
    if (srcTime > targetTime) {
      const ts = (await import('typescript')).default;
      const module = ctx.moduleType === 'module' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS;
      await fs.mkdir(path.dirname(target), { recursive: true });
      const text = await fs.readFile(src, 'utf8');
      if (file.endsWith('.js')) {
        let content = ts.transpile(text, {
          target: ts.ScriptTarget.ES2020, module, esModuleInterop: true, allowSyntheticDefaultImports: true
        });
        if (ctx.moduleType === 'module') {
          content = content.replace(/^((?:im|ex)port .*from '[.][^']+)(')/mg, (_, a, b) => `${a}.js${b}`)
            .replace(/^(import [^\n]*from '[^.][^\n/]+[/][^\n/]+[/][^\n']+)(')/mg, (_, a, b) => `${a}.js${b}`);
        }
        await fs.writeFile(target, content, 'utf8');
      } else {
        const pkg = JSON.parse(text);
        pkg.type = ctx.moduleType;
        await fs.writeFile(target, JSON.stringify(pkg, null, 2), 'utf8');
      }
      // Compile
    }
    files.push(target);
  }

  try { return await require(files[0]); }
  catch { return import(files[0]); }
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
  const ctx = await getManifestContext();
  const { op, outputPath, env, ...flags } = parseArgs(process.argv.slice(2));
  const message = flags.quiet ? () => { } : console.log.bind(console);

  // Clean if needed
  if (op === 'clean' || (op && flags.clean)) {
    await fs.rm(path.resolve(ctx.workspacePath, ctx.outputFolder), { force: true, recursive: true });
    await fs.rm(path.resolve(ctx.workspacePath, ctx.compilerFolder), { force: true, recursive: true });
    if (op === 'clean') {
      return message(`Cleaned ${ctx.workspacePath}: [${ctx.outputFolder}, ${ctx.compilerFolder}]`);
    }
  }

  const { compile, exportManifest } = await $getLauncher(ctx);

  switch (op) {
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

      // Rewriting node_path
      const out = path.join(ctx.workspacePath, ctx.outputFolder);
      const nodeOut = path.resolve(out, 'node_modules');
      const og = process.env.NODE_PATH;
      process.env.NODE_PATH = [nodeOut, og].join(path.delimiter);
      // @ts-expect-error
      Module._initPaths();
      process.env.NODE_PATH = og; // Restore

      process.env.TRV_THROW_ROOT_INDEX_ERR = '1';
      process.env.TRV_MANIFEST = path.resolve(nodeOut, ctx.mainModule);

      // TODO: Externalize somehow?
      const cliMain = path.join(out, 'node_modules/@travetto/cli/support/cli.js');
      await import(cliMain);
    }
  }
};

exec();