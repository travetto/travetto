const TRV_MOD = /(@travetto\/[^= ,]+)(\s*=[^,]+)?(,)?/g;

/**
 * Naive hashing
 * @param {string} text
 */
function naiveHash(text) {
  let hash = 5381;

  for (let i = 0; i < text.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = (hash * 33) ^ text.charCodeAt(i);
  }

  return Math.abs(hash);
}

/**
 * Gather all dependencies of a given module
 * @param {string} root
 * @param {Iterable<string>} givenMods
 */
function readDeps(root, givenMods) {
  const path = require('path');
  const { name, dependencies, devDependencies } = require(path.resolve(root, 'package.json'));
  const keys = [
    ...givenMods, // Givens
    ...Object.keys(dependencies || {}),
    ...Object.keys(devDependencies || {})
  ]
    .filter(x => x.startsWith('@travetto'));

  const final = new Map();

  while (keys.length) {
    const top = keys.shift();
    final.set(top, null);
    const deps = require(`${top.replace('@travetto', process.env.TRV_DEV)}/package.json`).dependencies ?? {};

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
    entries: [...final.entries()].filter(([k, v]) => k !== name).map(x => x.join('='))
  };
}

const { FileCache } = require('./src/cache');
const cache = new FileCache(process.env.TRV_CACHE ?? '.trv_cache');
cache.init();

const envMods = process.env.TRV_MODULES ?? '';
const content = cache.getOrSet(`isolated-modules.${naiveHash(envMods)}.json`,
  () => {
    const defaultMods = new Set(['@travetto/test', '@travetto/cli', '@travetto/doc', '@travetto/app', '@travetto/log']);
    envMods.replace(TRV_MOD, (_, m) => defaultMods.add(m));
    return JSON.stringify(readDeps(process.cwd(), defaultMods), null, 2);
  }
);
const { entries } = JSON.parse(content);
process.env.TRV_MODULES = `${envMods.replace(TRV_MOD, '')},${entries.join(',')}`;

// Force install
require('./src/compile').CompileUtil.init();