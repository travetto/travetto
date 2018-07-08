const path = require('path');
const { execSync } = require('child_process');

const e = process.env;

const envs = [
  'application', ...(e.ENV || e.env || e.NODE_ENV || 'dev').toLowerCase().split(/[, ]+/)
];

const envSet = new Set(envs);
const is = envSet.has.bind(envSet);

const cwd = (process.env.INIT_CWD || process.cwd()).replace(/[\\]+/g, path.sep).replace(/[\/\\]+$/, '');
const prod = is('prod') || is('production');
const test = is('test') || is('testing');
const dev = !prod && !test;
const watch = (dev && !('NO_WATCH' in e)) || 'WATCH' in e;
const debug = ('DEBUG' in e && !!e.DEBUG) || dev;
const trace = ('TRACE' in e && !!e.TRACE);

let docker = !('NO_DOCKER' in e && !!e.NO_DOCKER);
if (docker) { // Check for docker existance
  try {
    execSync('docker ps', { stdio: [undefined, undefined, undefined] });
  } catch (e) {
    docker = false;
  }
}

console.warn = (...args) => console.log('WARN', ...args);
console.info = (...args) => console.log('INFO', ...args);
console.debug = (...args) => console.log('DEBUG', ...args);
console.trace = (...args) => console.log('TRACE', ...args);

if (!trace) {
  console.trace = (...args) => {};
}

if (!debug) {
  console.debug = () => {}; // Suppress debug statements
}

function error(...args) {
  console.error(...args.map(x => x && x.stack ? x.stack : x));
}

const AppEnv = { prod, dev, test, is, watch, all: envs, debug, trace, docker, cwd, error };

module.exports = { AppEnv };