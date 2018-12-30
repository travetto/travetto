//@ts-check
const { cwd } = require('./_app-core');

const PROD_KEY = 'prod';
const TEST_KEY = 'test';
const E2E_KEY = 'e2e';
const DEV_KEY = 'dev';

const envVal = (k, def) => {
  const temp = process.env[k] || process.env[k.toLowerCase()] || process.env[k.toUpperCase()];
  return temp === undefined ? def : temp;
};
const envListVal = k => (envVal(k) || '').split(/[, ]+/g).filter(x => !!x);
const isEnvTrue = k => {
  const val = envVal(k);
  return val !== undefined && /(1|true|on)/i.test(val);
};
const isEnvFalse = k => {
  const val = envVal(k);
  return val !== undefined && /(0|false|off)/i.test(val);
};

function checkFrameworkDev() {
  let frameworkDev = false;

  try {
    frameworkDev = require(`${cwd}/package.json`).name.startsWith('@travetto');
  } catch (e) { }

  return { frameworkDev };
}

function checkDocker() {
  let docker = !isEnvTrue('NO_DOCKER');
  if (docker) { // Check for docker existence
    try {
      const { execSync } = require('child_process');
      execSync('docker ps', { stdio: [undefined, undefined, undefined] });
    } catch (e) {
      docker = false;
    }
  }
  return { docker };
}

function checkWatch() {
  return { watch: isEnvTrue('watch') };
}

function buildLogging(profile) {
  const debug = isEnvTrue('debug') || ((profile.dev || profile.e2e) && !isEnvFalse('debug'));
  const trace = isEnvTrue('trace');
  const quietInit = isEnvTrue('quiet_init') || profile.test;

  console.warn = (...args) => console.log('WARN', ...args);
  console.info = (...args) => console.log('INFO', ...args);
  console.debug = (...args) => console.log('DEBUG', ...args);
  console.trace = (...args) => console.log('TRACE', ...args);

  if (!trace) {
    console.trace = () => { };
  }

  if (!debug) {
    console.debug = () => { }; // Suppress debug statements
  }

  function error(...args) {
    console.error(...args.map(x => x && x.stack ? x.stack : x));
  }

  return { debug, trace, error, quietInit };
}

function buildProfile() {

  const mapping = {
    production: PROD_KEY,
    testing: TEST_KEY,
    development: DEV_KEY
  };

  const ext = [...envListVal('node_env'), ...envListVal('env'), ...envListVal('profile')]
    .map(x => mapping[x] || x);

  const primary =
    (ext.includes(PROD_KEY) && PROD_KEY) ||
    (ext.includes(TEST_KEY) && TEST_KEY) ||
    (ext.includes(E2E_KEY) && E2E_KEY) ||
    DEV_KEY;

  const allSet = new Set();

  // Shift to front
  const all = ['application', primary, ...ext]
    .filter(x => {
      const isNew = !allSet.has(x);
      allSet.add(x);
      return isNew;
    });

  return {
    profiles: all,
    hasProfile: allSet.has.bind(allSet),
    prod: primary === PROD_KEY,
    test: primary === TEST_KEY,
    e2e: primary === E2E_KEY,
    dev: primary === DEV_KEY
  };
}

const profile = buildProfile();

const Env = [
  { cwd },
  { isTrue: isEnvTrue, isFalse: isEnvFalse, get: envVal, getList: envListVal },
  profile,
  buildLogging(profile),
  checkWatch(),
  checkFrameworkDev(),
  checkDocker()
].reduce((acc, el) =>
  Object.assign(acc, el));

function showEnv() {
  if (!Env.quietInit) {
    console.log('Env', JSON.stringify(Env,
      (e, v) => typeof v === 'boolean' && v === false || typeof v === 'function' ? undefined : v, 2));
  }
}

module.exports = { Env, showEnv };