// @ts-check
import { statSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';

import { getManifestContext } from '@travetto/manifest/bin/context.js';

/** @typedef {import('@travetto/manifest').ManifestContext} Ctx */

const TS_EXT = /[.]tsx?$/;

const getAge = (f = '', st = statSync(f)) => Math.max(st.mtimeMs, st.ctimeMs);
const target = (/** @type {Ctx} */ ctx, /** @type {string} */ file) => ({
  dest: path.resolve(ctx.workspace.path, ctx.build.compilerFolder, 'node_modules', '@travetto/compiler', file).replace(TS_EXT, '.js'),
  src: path.resolve(ctx.workspace.path, ctx.build.compilerModuleFolder, file),
  writeIfStale(/** @type {(text:string)=>string}*/ transform) {
    if (!existsSync(this.dest) || getAge(this.dest) < getAge(this.src)) {
      const text = readFileSync(this.src, 'utf8');
      mkdirSync(path.dirname(this.dest), { recursive: true });
      writeFileSync(this.dest, transform(text), 'utf8');
    }
  }
});

async function transpiler(/** @type {Ctx} */ ctx) {
  const ts = (await import('typescript')).default;
  return (/** @type {string} */  content) => {
    const tsconfig = path.resolve(ctx.workspace.path, 'tsconfig.json');
    existsSync(tsconfig) || writeFileSync(tsconfig, JSON.stringify({ extends: '@travetto/compiler/tsconfig.trv.json' }), 'utf8');
    const module = ctx.workspace.type === 'module' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS;
    return ts.transpile(content, { target: ts.ScriptTarget.ES2022, module, esModuleInterop: true, allowSyntheticDefaultImports: true });
  };
}

async function compile(/** @type {Ctx} */ ctx) {
  target(ctx, 'package.json').writeIfStale(text => JSON.stringify(Object.assign(JSON.parse(text), { type: ctx.workspace.type }), null, 2));
  let transpile;

  for (const file of readdirSync(target(ctx, 'support').src, { recursive: true, encoding: 'utf8' })) {
    if (TS_EXT.test(file)) { target(ctx, `support/${file}`).writeIfStale(transpile ??= await transpiler(ctx)); }
  }

  return target(ctx, 'support/entry.trvc.ts').dest;
}

/** @returns {Promise<import('@travetto/compiler/support/entry.trvc')>} */
const imp = async (pth = '') => { try { return require(pth); } catch (err) { return import(pth); } };

export async function getEntry() {
  const ctx = getManifestContext();
  const entry = await compile(ctx);
  try {
    return await imp(entry).then(v => v.main(ctx));
  } catch (err) {
    rmSync(target(ctx, '.').dest, { recursive: true, force: true });
    throw err;
  }
}