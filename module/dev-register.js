const root = process.env.TRV_DEV_ROOT;
const { FsUtil } = require(`${root}/boot/src/fs`);

/**
 * Gather all dependencies of a given module
 * @param {string} root
 */
function readDeps() {
  const existing = (process.env.TRV_MODULES ?? '').trim().split(/\s*,\s*/).map(x => x.split('='));

  const { dependencies, devDependencies } = require(`${FsUtil.cwd}/package.json`);
  const keys = [
    ...existing.filter(([k, v]) => k.startsWith('@travetto')).map(([k, v]) => k),
    '@travetto/test', '@travetto/cli', '@travetto/app', '@travetto/log', // Givens
    ...Object.keys(dependencies || {}),
    ...Object.keys(devDependencies || {})
  ]
    .filter(x => x.startsWith('@travetto'));

  const final = new Map();

  while (keys.length) {
    const top = keys.shift();
    const path = top.replace('@travetto', root);
    final.set(top, path);
    const deps = Object.keys(require(`${path}/package.json`).dependencies ?? {})
      .filter(x => x.startsWith('@travetto'));

    for (const sub of deps) {
      if (!final.has(sub)) {
        keys.push(sub);
      }
    }
  }

  return Object.fromEntries([
    ...final.entries(),
    ...existing.filter(([k, v]) => !k.startsWith('@travetto'))
  ]);
}

const { FileCache } = require(`${root}/boot/src/cache`);
const cache = new FileCache(process.env.TRV_CACHE ?? '.trv_cache');
cache.init();
const content = cache.getOrSet('dev-modules.json', () => JSON.stringify(readDeps()));
const resolved = Object.entries(JSON.parse(content));
process.env.TRV_MODULES = resolved.map(x => x.join('=')).join(',');

// Force install
require(`${root}/boot/src/compile`).CompileUtil.init();