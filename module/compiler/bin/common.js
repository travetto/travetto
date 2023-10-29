// @ts-check

import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

import { getManifestContext } from '@travetto/manifest/bin/context.js';

const COMPILER_FILES = [...['entry.trvc', 'log', 'queue', 'server/client', 'server/runner', 'server/server', 'setup', 'util'].map(x => `support/${x}.ts`), 'package.json'];

/** @typedef {import('@travetto/manifest/src/types').ManifestContext} Ctx */
/** @typedef {import('@travetto/compiler/support/types').EntryOp} EntryOp */

/** @return {Promise<import('@travetto/compiler/support/entry.trvc').main>} */
const $getEntry = async (/** @type {Ctx} */ ctx) => {
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
          { target: ts.ScriptTarget.ES2022, module, esModuleInterop: true, allowSyntheticDefaultImports: true }
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

async function $compile(/** @type {Ctx} ctx*/ ctx, /** @type {EntryOp} op */ op) {
  const rootCtx = await (ctx.monoRepo ? getManifestContext(ctx.workspacePath) : ctx);
  return (await $getEntry(ctx))(ctx, rootCtx, op, process.argv.slice(3));
}

/**
 * @template T
 * @param {(ctx: Ctx, compile: typeof $compile)  => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withContext(fn) {
  const ctx = await getManifestContext();
  return fn(ctx, $compile);
}