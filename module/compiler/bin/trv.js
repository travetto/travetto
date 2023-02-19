#!/usr/bin/env node

// @ts-check
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

import { getManifestContext } from '@travetto/manifest/bin/context.js';

const VALID_OPS = { watch: 'watch', build: 'build', clean: 'clean', manifest: 'manifest' };

/**
 * @param {import('@travetto/manifest').ManifestContext} ctx
 * @return {Promise<import('@travetto/compiler/support/launcher').launch>}
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

  try { return require(files[0]).launch; }
  catch { return import(files[0]).then(x => x.launch); }
};

(async () => {
  const ctx = await getManifestContext();
  const [op, args] = [VALID_OPS[process.argv[2]], process.argv.slice(3)];

  if (op === 'clean') {
    const folders = process.argv.find(x => x === '--all' || x === '-a') ? [ctx.outputFolder, ctx.compilerFolder] : [ctx.outputFolder];
    for (const f of folders) {
      await fs.rm(path.resolve(ctx.workspacePath, f), { force: true, recursive: true });
    }
    return console.log(`Cleaned ${ctx.workspacePath}: [${folders.join(', ')}]`);
  }

  const rootCtx = ctx.monoRepo ? await getManifestContext(ctx.workspacePath) : ctx;

  return (await $getLauncher(ctx))(ctx, rootCtx, op, args);
})();