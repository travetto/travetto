const requireDev = (m) => require(m.replace('@travetto', process.env.TRV_DEV));

const { FsUtil } = requireDev('@travetto/boot/src/fs');

/**
 * Gather all dependencies of a given module
 * @param {string} root
 */
function readDeps() {
  const { name, dependencies, devDependencies } = require(FsUtil.resolveUnix('package.json'));
  const keys = [
    '@travetto/test', '@travetto/cli',
    '@travetto/doc',
    '@travetto/app', '@travetto/log', // Givens
    ...Object.keys(dependencies || {}),
    ...Object.keys(devDependencies || {})
  ]
    .filter(x => x.startsWith('@travetto'));

  const final = new Map();

  while (keys.length) {
    const top = keys.shift();
    final.set(top, null);
    const deps = Object.keys(requireDev(`${top}/package.json`).dependencies ?? {})
      .filter(x => x.startsWith('@travetto'));

    for (const sub of deps) {
      if (!final.has(sub)) {
        keys.push(sub);
      }
    }
  }

  return Object.fromEntries([...final.entries()].filter(([k, v]) => k !== name));
}

const { FileCache } = requireDev('@travetto/boot/src/cache');
const cache = new FileCache(process.env.TRV_CACHE ?? '.trv_cache');
cache.init();
const content = cache.getOrSet('dev-modules.json', () => JSON.stringify(readDeps()));
const resolved = Object.entries(JSON.parse(content));
process.env.TRV_MODULES = `${process.env.TRV_MODULES || ''},${resolved.map(x => x.join('=')).join(',')}`;

// Force install
requireDev(`@travetto/boot/src/compile`).CompileUtil.init();