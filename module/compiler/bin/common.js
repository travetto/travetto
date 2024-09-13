// @ts-check
const { statSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } = require('node:fs');
const path = require('node:path');

const { getManifestContext } = require('@travetto/manifest/bin/context.js');

/** @typedef {import('@travetto/manifest').ManifestContext} Ctx */

const TS_EXT = /[.]tsx?$/;

const getAge = (/** @type {{mtimeMs:number, ctimeMs:number}} */ st) => Math.max(st.mtimeMs, st.ctimeMs);

const modPath = (/** @type {Ctx} */ ctx, mod, file) => {
  const base = path.resolve(ctx.workspace.path, ctx.build.compilerFolder, 'node_modules', mod, file);
  return `${base}${file.includes('.') ? '' : file.includes('/') ? '.ts' : '/__index__.ts'}`.replace(TS_EXT, '.js');
};

const getTarget = (/** @type {Ctx} */ ctx, file = '') => ({
  dest: modPath(ctx, '@travetto/compiler', file),
  src: path.resolve(ctx.workspace.path, ctx.build.compilerModuleFolder, file),
  async writeIfStale(/** @type {(text:string)=>(string|Promise<string>)}*/ transform) {
    if (!existsSync(this.dest) || getAge(statSync(this.dest)) < getAge(statSync(this.src))) {
      const text = readFileSync(this.src, 'utf8');
      mkdirSync(path.dirname(this.dest), { recursive: true });
      writeFileSync(this.dest, await transform(text), 'utf8');
    }
  }
});

const getTranspiler = async (/** @type {Ctx} */ ctx) => {
  const ts = require('typescript');
  const module = ctx.workspace.type === 'module' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS;
  return (content = '') =>
    ts.transpile(content, { target: ts.ScriptTarget.ES2022, module, esModuleInterop: true, allowSyntheticDefaultImports: true })
      .replace(/from '([.][^']+)'/g, (_, i) => `from '${i.replace(/[.]js$/, '')}.js'`)
      .replace(/from '(@travetto\/[^/']+)([/][^']+)?'/g, (_, mod, file) => `from '${modPath(ctx, mod, file)}'`);
};

export async function getEntry() {
  process.setSourceMapsEnabled(true); // Ensure source map during compilation/development
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --enable-source-maps`; // Ensure it passes to children

  const ctx = getManifestContext();
  const target = getTarget.bind(null, ctx);

  // Setup Tsconfig
  const tsconfig = path.resolve(ctx.workspace.path, 'tsconfig.json');
  existsSync(tsconfig) || writeFileSync(tsconfig,
    JSON.stringify({ extends: '@travetto/compiler/tsconfig.trv.json' }), 'utf8');

  // Compile support folder
  await target('package.json').writeIfStale(text =>
    JSON.stringify(Object.assign(JSON.parse(text), { type: ctx.workspace.type }), null, 2)
  );

  let transpile;
  for (const file of readdirSync(target('support').src, { recursive: true, encoding: 'utf8' })) {
    if (TS_EXT.test(file)) {
      await target(`support/${file}`).writeIfStale(async (text) =>
        (transpile ??= await getTranspiler(ctx))(text)
      );
    }
  }

  // Load
  try {
    return await require(target('support/entry.trvc.ts').dest).then(v => v.main(ctx));
  } catch (err) {
    rmSync(target('.').dest, { recursive: true, force: true });
    throw err;
  }
}