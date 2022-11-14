const fs = require('fs/promises');

const { path } = require('@travetto/common');

const recent = file => fs.stat(file).then(stat => Math.max(stat.ctimeMs, stat.mtimeMs));

async function isFolderStale(folder) {
  const flags = await Promise.all(
    (await fs.readdir(folder))
      .filter(x => !x.startsWith('.'))
      .map(x => path.resolve(folder, x))
      .map(async f => Promise.all([recent(f), recent(f.replace(/[.]ts$/, '.js'))])
        .then(([l, r]) => l > r)
        .catch(() => true)
      )
  );
  return flags.some(x => x === true);
}

const logTarget = process.env.DEBUG === 'build' ? console.debug.bind(console) : () => { };

const log = (...args) => logTarget(...args);

module.exports = { log, isFolderStale };
