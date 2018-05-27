const os = require('os');
const { execSync } = require('child_process');

const e = process.env;

const envs = [
  'application', ...(e.ENV || e.env || e.NODE_ENV || 'dev').toLowerCase().split(/[, ]+/)
];

const envSet = new Set(envs);

const is = envSet.has.bind(envSet);

const cwd = (process.env.INIT_CWD || process.cwd()).replace(/[\/\\]+$/, '');
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

const cache = {
  dir: process.env.TS_CACHE_DIR,
  name: cwd.replace(/[\/\\.]/g, '_'),
  sep: process.env.TS_CACHE_SEP || '~'
};

cache.sepRe = new RegExp(cache.sep, 'g');

if (!cache.dir) {
  cache.dir = `${os.tmpdir()}/${cache.name}`;
}

const AppEnv = { prod, dev, test, is, watch, all: envs, debug, docker, cwd, cache };

module.exports = { AppEnv };