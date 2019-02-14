const { FsUtil } = require('./fs-util');

//@ts-check
const PROD_KEY = 'prod';

const envVal = (k, def) => {
  const temp = process.env[k] || process.env[k.toLowerCase()] || process.env[k.toUpperCase()];
  return temp === undefined ? def : temp;
};
const envListVal = k => (envVal(k) || '').split(/[, ]+/g).filter(x => !!x);
const envIntVal = (k, def) => parseInt(envVal(k, def), 10);
const isEnvTrue = k => {
  const val = envVal(k);
  return val !== undefined && /(1|true|on|yes)/i.test(val);
};
const isEnvFalse = k => {
  const val = envVal(k);
  return val !== undefined && /(0|false|off|no)/i.test(val);
};

function checkFrameworkDev() {
  let inFramework = false;

  try {
    inFramework = require(`${FsUtil.cwd}/package.json`).name.startsWith('@travetto');
  } catch (e) {}

  return { frameworkDev: inFramework ? process.platform : undefined };
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
  const debug = isEnvTrue('debug') || (profile.dev && !isEnvFalse('debug'));
  const trace = isEnvTrue('trace');
  const quietInit = isEnvTrue('quiet_init');

  console.warn = (...args) => console.log('WARN', ...args);
  console.info = (...args) => console.log('INFO', ...args);
  console.debug = (...args) => console.log('DEBUG', ...args);
  console.trace = (...args) => console.log('TRACE', ...args);

  if (!trace) {
    console.trace = () => {};
  }

  if (!debug) {
    console.debug = () => {}; // Suppress debug statements
  }

  function error(...args) {
    console.error(...args.map(x => x && x.stack ? x.stack : x));
  }

  return { debug, trace, error, quietInit };
}

function buildProfile() {

  const mapping = {
    production: PROD_KEY
  };

  const ext = [...envListVal('node_env'), ...envListVal('env'), ...envListVal('profile')]
    .map(x => mapping[x] || x);

  const prod = ext.includes(PROD_KEY) && PROD_KEY;

  const allSet = new Set();

  // Shift to front
  const all = ['application', prod || '', ...ext]
    .filter(x => !!x)
    .filter(x => {
      const isNew = !allSet.has(x);
      allSet.add(x);
      return isNew;
    });

  const isApp = !isEnvFalse('APP_ROOT');
  const appRoot = envVal('APP_ROOT', '');

  return {
    profiles: all,
    hasProfile: allSet.has.bind(allSet),
    prod,
    dev: !prod,
    appRoot: isApp ? appRoot : '',
    isApp
  };
}

const profile = buildProfile();

const Env = [
  { cwd: FsUtil.cwd },
  { isTrue: isEnvTrue, isFalse: isEnvFalse, get: envVal, getList: envListVal, getInt: envIntVal },
  profile,
  buildLogging(profile),
  checkWatch(),
  checkFrameworkDev(),
  checkDocker()
].reduce((acc, el) =>
  Object.assign(acc, el));

function showEnv() {
  if (!Env.quietInit) {
    console.info('Env',
      JSON.stringify(Env, (e, v) =>
        (typeof v === 'boolean' && v === false) ||
        (typeof v === 'string' && v === '') ||
        (typeof v === 'function') ? undefined : v, 2
      )
    );
  }
}

module.exports = { Env, showEnv };