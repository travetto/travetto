const defaultMods = ['@travetto/test', '@travetto/cli', '@travetto/doc', '@travetto/app', '@travetto/log'];
const existing = (process.env.TRV_MODULES || '');
const cleaned = existing.replace(/(@travetto\/[^= ,]+)(\s*=[^,]+)?(,)?/g, (a, m) => {
  if (!defaultMods.includes(m)) {
    defaultMods.push(m);
  }
  return '';
});

/**
 * Gather all dependencies of a given module
 * @param {string} root
 */
function readDeps() {
  const path = require('path');
  const { name, dependencies, devDependencies } = require(path.resolve('package.json'));
  const keys = [
    ...defaultMods, // Givens
    ...Object.keys(dependencies || {}),
    ...Object.keys(devDependencies || {})
  ]
    .filter(x => x.startsWith('@travetto'));

  const final = new Map();

  while (keys.length) {
    const top = keys.shift();
    final.set(top, null);
    const deps = require(`${top.replace(/@travetto/, process.env.TRV_DEV)}/package.json`).dependencies ?? {};

    for (const sub of Object.keys(deps)) {
      if (sub.startsWith('@travetto') && !final.has(sub)) {
        keys.push(sub);
      }
    }
  }

  return {
    env: {
      TIME: Date.now(),
      ...Object.fromEntries(Object
        .entries(process.env)
        .filter(([k]) => k.startsWith('TRV_'))
        .sort((a, b) => a[0].localeCompare(b[0]))),
    },
    entries: Object.fromEntries([...final.entries()].filter(([k, v]) => k !== name))
  };
}

const { FileCache } = require('./src/cache');
const cache = new FileCache(process.env.TRV_CACHE ?? '.trv_cache');
cache.init();
const content = cache.getOrSet(`dev-modules.${existing.length}.json`, () => JSON.stringify(readDeps(), null, 2));
const resolved = Object.entries(JSON.parse(content).entries);
process.env.TRV_MODULES = `${cleaned},${resolved.map(x => x.join('=')).join(',')}`;

// Force install
require(`./src/compile`).CompileUtil.init();