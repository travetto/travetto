#!/usr/bin/env node

// @ts-check
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

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
 * @returns {{ op?: keyof typeof VALID_OPS, clean?: boolean, outputPath?: string, env?: string }}
 */
function parseArgs(args) {
  const op = VALID_OPS[args.find(x => !x.startsWith('-')) ?? ''];
  return {
    op,
    clean: args.includes('--clean') || args.includes('-c'),
    ...(op === 'manifest' ? { outputPath: args[1], env: args[2] } : {})
  };
}

const exec = async () => {
  const ctx = await getManifestContext();
  const { op, outputPath, env, ...flags } = parseArgs(process.argv.slice(2));

  // Clean if needed
  if (op === 'clean' || (op && flags.clean)) {
    for (const f of [ctx.outputFolder, ctx.compilerFolder]) {
      await fs.rm(path.resolve(ctx.workspacePath, f), { force: true, recursive: true });
    }
  }

  if (op === 'clean') { // Clean needs to not attempt to compile/load launcher
    return console.log(`Cleaned ${ctx.workspacePath}: [${ctx.outputFolder}, ${ctx.compilerFolder}]`);
  }

  const { compile, launchMain, exportManifest } = await $getLauncher(ctx);

  switch (op) {
    case 'manifest': return exportManifest(ctx, outputPath ?? '', env);
    case 'watch':
    case 'build': return compile(ctx, op);
    default:
      await compile(ctx, op);
      return launchMain(ctx);
  }
};

exec();