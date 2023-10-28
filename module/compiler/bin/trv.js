#!/usr/bin/env node

// @ts-check
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

import { getManifestContext } from '@travetto/manifest/bin/context.js';

const VALID_OPS = { watch: 'watch', build: 'build', clean: 'clean', manifest: 'manifest' };

const COMPILER_FILES = [...['entry.trv', 'log', 'queue', 'server/client', 'server/runner', 'server/server', 'setup', 'util'].map(x => `support/${x}.ts`), 'package.json'];

/**
 * @param {import('@travetto/manifest').ManifestContext} ctx
 * @return {Promise<import('@travetto/compiler/support/entry.trv').main>}
 */
const $getEntry = async (ctx) => {
  const tsconfigFile = path.resolve(ctx.workspacePath, 'tsconfig.json');
  if (!(await fs.stat(tsconfigFile).catch(() => undefined))) {
    await fs.writeFile(tsconfigFile, JSON.stringify({ extends: '@travetto/compiler/tsconfig.trv.json' }), 'utf8');
  }
  const compMod = path.dirname(createRequire(path.resolve(ctx.workspacePath, 'node_modules')).resolve('@travetto/compiler/package.json'));
  const files = [];

  for (const file of COMPILER_FILES) {
    const target = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', '@travetto/compiler', file).replace(/[.]tsx?$/, '.js');
    const src = path.resolve(compMod, file);

    const targetTime = await fs.stat(target).then(s => Math.max(s.mtimeMs, s.ctimeMs)).catch(() => 0);
    const srcTime = await fs.stat(src).then(s => Math.max(s.mtimeMs, s.ctimeMs));
    // If stale
    if (srcTime > targetTime) {
      const ts = (await import('typescript')).default;
      const module = ctx.moduleType === 'module' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS;
      await fs.mkdir(path.dirname(target), { recursive: true });
      const text = await fs.readFile(src, 'utf8');
      if (/[.]tsx?$/.test(file)) {
        const content = ts.transpile(
          text,
          { target: ts.ScriptTarget.ES2020, module, esModuleInterop: true, allowSyntheticDefaultImports: true }
        )
          .replace(/^((?:im|ex)port .*from '[.][^']+)(')/mg, (_, a, b) => `${a}.js${b}`)
          .replace(/^(import [^\n]*from '[^.][^\n/]+[/][^\n/]+[/][^\n']+)(')/mg, (_, a, b) => `${a}.js${b}`);
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

  try { return require(files[0]).main; }
  catch { return import(files[0]).then(x => x.main); }
};

(async () => {
  const ctx = await getManifestContext();
  const [op, args] = [VALID_OPS[process.argv[2]], process.argv.slice(3)];

  if (op && process.argv.some(x => x === '--stop-server' || x === '-s')) {
    await fetch(`${ctx.compilerUrl}/close`).then(v => v.ok).catch(() => { });
    console.log(`Stopped server ${ctx.workspacePath}: [${ctx.compilerUrl}]`);
  }

  if (op === 'clean') {
    if (await fetch(`${ctx.compilerUrl}/clean`).then(v => v.ok).catch(() => { })) {
      return console.log(`Clean triggered ${ctx.workspacePath}: [${ctx.outputFolder}]`);
    } else {
      for (const f of [ctx.compilerFolder, ctx.outputFolder]) {
        await fs.rm(path.resolve(ctx.workspacePath, f), { force: true, recursive: true });
      }
      return console.log(`Cleaned ${ctx.workspacePath}: [${ctx.outputFolder}]`);
    }
  }

  const rootCtx = ctx.monoRepo ? await getManifestContext(ctx.workspacePath) : ctx;

  return (await $getEntry(ctx))(ctx, rootCtx, op ?? 'run', args);
})();