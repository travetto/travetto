// @ts-check
import { statSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';

import { getManifestContext } from '@travetto/manifest/bin/context.js';

/** @typedef {import('@travetto/manifest').ManifestContext} Ctx */

const TS_EXT = /[.]tsx?$/;

const getAge = (f = '', st = statSync(f)) => Math.max(st.mtimeMs, st.ctimeMs);

const getTarget = (/** @type {Ctx} */ ctx, file = '') => ({
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

const getTranspiler = async (/** @type {Ctx} */ ctx) => {
  const ts = (await import('typescript')).default;
  const tsconfig = path.resolve(ctx.workspace.path, 'tsconfig.json');
  existsSync(tsconfig) || writeFileSync(tsconfig, JSON.stringify({ extends: '@travetto/compiler/tsconfig.trv.json' }), 'utf8');
  const module = ctx.workspace.type === 'module' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS;
  return (content = '') => ts.transpile(content, { target: ts.ScriptTarget.ES2022, module, esModuleInterop: true, allowSyntheticDefaultImports: true });
};


/** @returns {Promise<import('@travetto/compiler/support/entry.trvc')>} */
async function imp(f = '') { try { return require(f); } catch (err) { return import(f); } }

export async function getEntry() {
  const ctx = getManifestContext();
  const target = getTarget.bind(null, ctx);

  // Compile
  target('package.json').writeIfStale(text => JSON.stringify(Object.assign(JSON.parse(text), { type: ctx.workspace.type }), null, 2));

  let transpile;
  for (const file of readdirSync(target('support').src, { recursive: true, encoding: 'utf8' })) {
    if (TS_EXT.test(file)) { target(`support/${file}`).writeIfStale(transpile ??= await getTranspiler(ctx)); }
  }

  // Load
  try {
    return await imp(target('support/entry.trvc.ts').dest).then(v => v.main(ctx));
  } catch (err) {
    rmSync(target('.').dest, { recursive: true, force: true });
    throw err;
  }
}