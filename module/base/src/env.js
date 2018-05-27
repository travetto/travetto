const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const e = process.env;

const envs = [
  'application', ...(e.ENV || e.env || e.NODE_ENV || 'dev').toLowerCase().split(/[, ]+/)
];

const envSet = new Set(envs);
const is = envSet.has.bind(envSet);

const cwd = (process.env.INIT_CWD || process.cwd()).replace(/[\/\\]+$/, '').replace(/[\\]+/g, '/');
const prod = is('prod') || is('production');
const test = is('test') || is('testing');
const dev = !prod && !test;
const watch = (dev && !('NO_WATCH' in e)) || 'WATCH' in e;
const debug = 'DEBUG' in e && !!e.DEBUG;

let docker = !('NO_DOCKER' in e && !!e.NO_DOCKER);
if (docker) { // Check for docker existance
  try {
    docker = execSync('docker ps') && true;
  } catch (e) {}
}

let cacheDir = process.env.TS_CACHE_DIR;
if (!cacheDir) {
  const name = cwd.replace(/\//g, '_');
  cacheDir = `${os.tmpdir().replace(/[\\]+/g, '/')}/${name}`;
}

const cacheDirN = path.normalize(cacheDir);
const cacheSep = process.env.TS_CACHE_SEP || '~';
const cacheSepRe = new RegExp(cacheSep, 'g');

const cache = {};
cache.fromEntryName = cached => path.normalize(`${cwd}/${cached.replace(cacheDir, '').replace(cacheSepRe, '/').replace(/@ts$/, '.ts')}`);
cache.toEntryName = full => path.normalize(`${cacheDir}/${full.replace(cwd, '').replace(/\/+/g, cacheSep).replace(/.ts$/, '@ts')}`);
cache.init = () => {
  if (!fs.existsSync(cacheDirN)) {
    fs.mkdirSync(cacheDirN);
  }

  const CACHE = {};

  for (const f of fs.readdirSync(cacheDirN)) {
    const full = cache.fromEntryName(f);
    const rel = `${cacheDir}/${f}`;
    const relN = path.normalize(rel);
    try {
      const stat = CACHE[relN] = fs.statSync(relN);
      const fullStat = fs.statSync(full);
      if (stat.ctimeMs < fullStat.ctimeMs || stat.mtimeMs < fullStat.mtimeMs || stat.atime < fullStat.mtime) {
        fs.unlinkSync(relN);
        delete CACHE[relN];
      }
    } catch (e) {
      // Cannot remove missing file
    }
  }

  return CACHE;
};

const AppEnv = { prod, dev, test, is, watch, all: envs, debug, docker, cwd, cache };

module.exports = { AppEnv };