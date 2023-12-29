// @ts-check
import fs from 'node:fs/promises';
import path from 'node:path';

import { getManifestContext } from '@travetto/manifest/bin/context.js';

/** @typedef {import('@travetto/manifest').ManifestContext} Ctx */
/** @typedef {(ctx: Ctx, content:string) => (string | Promise<string>)} Transform */

const stat = (/** @type {string}*/ file) => fs.stat(file).then(s => Math.max(s.mtimeMs, s.ctimeMs)).catch(() => 0);
const TS_EXT = /[.]tsx?$/;

const /** @type {Transform} */ transpile = async (ctx, content, tsconfig = path.resolve(ctx.workspace.path, 'tsconfig.json')) => {
  await fs.stat(tsconfig).catch(() => fs.writeFile(tsconfig, JSON.stringify({ extends: '@travetto/compiler/tsconfig.trv.json' }), 'utf8'));
  const ts = (await import('typescript')).default;
  const module = ctx.workspace.moduleType === 'module' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS;
  return ts.transpile(content, { target: ts.ScriptTarget.ES2022, module, esModuleInterop: true, allowSyntheticDefaultImports: true });
};

const /** @type {Transform} */ rewritePackage = (ctx, content) =>
  JSON.stringify(Object.assign(JSON.parse(content), { type: ctx.workspace.moduleType }), null, 2);

async function outputIfChanged(/** @type {Ctx} */ ctx, /** @type {string} */ file, /** @type {Transform} */ transform) {
  const target = path.resolve(ctx.workspace.path, ctx.build.compilerFolder, 'node_modules', '@travetto/compiler', file).replace(TS_EXT, '.js');
  const src = path.resolve(ctx.workspace.path, ctx.build.compilerModuleFolder, file);

  if (await stat(src) > await stat(target)) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const content = await fs.readFile(src, 'utf8');
    await fs.writeFile(target, await transform(ctx, content), 'utf8');
  }
  return target;
}

export const getEntry = async () => {
  const ctx = await getManifestContext();
  const entry = await outputIfChanged(ctx, 'support/entry.trvc.ts', transpile);
  const run = (/** @type {import('@travetto/compiler/support/entry.trvc')} */ mod) => mod.main(ctx);

  await outputIfChanged(ctx, 'package.json', rewritePackage);

  await fs.readdir(path.resolve(ctx.workspace.path, ctx.build.compilerModuleFolder, 'support'), { recursive: true }).then(files =>
    Promise.all(files.filter(x => TS_EXT.test(x)).map(f => outputIfChanged(ctx, `support/${f}`, transpile))));

  try { return run(require(entry)); }
  catch { return import(entry).then(run); }
};