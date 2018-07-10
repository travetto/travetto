const path = require('path');
const { execSync } = require('child_process');

const p_env = process.env;

const envs = (p_env.ENV || p_env.env || p_env.NODE_ENV || '').toLowerCase().split(/[, ]+/);
const envSet = new Set(envs);
const env = envSet.has.bind(envSet);

const cwd = (process.env.INIT_CWD || process.cwd()).replace(/[\\]+/g, path.sep).replace(/[\/\\]+$/, '');
const prod = env('prod') || env('production');
const test = env('test') || env('testing');
const dev = !prod && !test;
const watch = (dev && !('NO_WATCH' in p_env)) || 'WATCH' in p_env;
const debug = ('DEBUG' in p_env && !!p_env.DEBUG) || ('debug' in p_env && !!p_env.debug) || dev;
const trace = ('TRACE' in p_env && !!p_env.TRACE) || ('trace' in p_env && !!p_env.trace);

const profiles = [
  'application',
  ...(p_env.profile || p_env.PROFILE || '').toLowerCase().split(/[, ]+/),
  prod ? 'prod' : '',
  test ? 'test' : '',
  dev ? 'dev' : '',
  ...envs,
  ...(process.argv.slice(2) || []) // Pull in args
].filter(x => !!x);
const profileSet = new Set(profiles);
const profile = profileSet.has.bind(profileSet);

let docker = !('NO_DOCKER' in p_env && !!p_env.NO_DOCKER);
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

const AppEnv = { prod, dev, test, watch, debug, trace, docker, cwd, error, profiles, is: profile };

module.exports = { AppEnv };