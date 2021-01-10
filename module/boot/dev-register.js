/**
 * Gather all dependencies of a given module
 * @param {string} root
 */
function readDeps() {
  const path = require('path');
  const { name, dependencies, devDependencies } = require(path.resolve('package.json'));
  const keys = [
    '@travetto/test', '@travetto/cli', '@travetto/doc', '@travetto/app', '@travetto/log', // Givens
    ...Object.keys(dependencies || {}),
    ...Object.keys(devDependencies || {})
  ]
    .filter(x => x.startsWith('@travetto'));

  const final = new Map();

  while (keys.length) {
    const top = keys.shift();
    final.set(top, null);
    const deps = require(`${top.replace(/@tavetto/, process.env.TRV_DEV)}/package.json`).dependencies ?? {};

    for (const sub of Object.keys(deps)) {
      if (sub.startsWith('@travetto') && !final.has(sub)) {
        keys.push(sub);
      }
    }
  }

  return Object.fromEntries([...final.entries()].filter(([k, v]) => k !== name));
}

const { FileCache } = require('./src/cache');
const cache = new FileCache(process.env.TRV_CACHE ?? '.trv_cache');
cache.init();
const content = cache.getOrSet('dev-modules.json', () => JSON.stringify(readDeps()));
const resolved = Object.entries(JSON.parse(content));
process.env.TRV_MODULES = `${process.env.TRV_MODULES || ''},${resolved.map(x => x.join('=')).join(',')}`;

// Force install
require(`./src/compile`).CompileUtil.init();