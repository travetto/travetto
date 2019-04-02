// @ts-check
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const pCwd = process.cwd().replace(/[\\\/]+/g, '/');
const cacheConfig = 'di-app-cache.json';

function handleFailure(err, exitCode = undefined) {
  console.error(err && err.toConsole ? err : (err && err.stack ? err.stack : err));
  if (exitCode) {
    process.exit(exitCode);
  }
}

function maxTime(stat) {
  return Math.max(stat.ctimeMs, stat.mtimeMs); // Do not include atime
}

const fsLstat = util.promisify(fs.lstat);

function getParamType(config) {
  return (config.meta && config.meta.choices) ? config.meta.choices.join('|') : config.type;
}

async function getAppList(killOnFail = true) {
  try {
    return await getCachedAppList();
  } catch (err) {
    handleFailure(err, killOnFail && 1);
  }
}

function processApplicationParam(config, param) {
  if (
    (config.type === 'boolean' && !/^(true|false|1|0|yes|no|on|off)/i.test(param)) ||
    (config.type === 'number' && !/^[-]?[0-9]*[.]?[0-9]*$/.test(param)) ||
    (config.meta && config.meta.choices && !config.meta.choices.find(c => `${c}` === param))
  ) {
    throw new Error(`Invalid parameter ${config.name}: Received ${param} expected ${getParamType(config)}`);
  }
  let out = param;
  switch (config.type) {
    case 'number':
      out = param.includes('.') ? parseFloat(param) : parseInt(param, 10);
      break;
    case 'boolean':
      out = /^(true|1|yes|on)$/i.test(param);
      break;
  }
  return out;
}

async function getAppByName(name) {
  return (await getAppList()).find(x => x.name === name);
}

async function runApp(args) {
  const name = args[0];
  let [, ...sub] = args;
  const app = await getAppByName(name);

  if (app) {
    const appParams = app.params || [];
    sub = sub.map((x, i) => appParams[i] === undefined ? x : processApplicationParam(appParams[i], x));
    const reqCount = appParams.filter(x => !x.optional).length;
    if (sub.length < reqCount) {
      throw new Error(`Invalid parameter count: received ${sub.length} but needed ${reqCount}`);
    }
  }

  process.env.APP_ROOTS = [
    process.env.APP_ROOTS || app.appRoot || '',
    !app.standalone && app.appRoot ? '.' : ''
  ].join(',');
  process.env.ENV = process.env.ENV || 'dev';
  process.env.PROFILE = process.env.PROFILE || '';
  process.env.WATCH = process.env.WATCH || app.watchable;

  await require('@travetto/base/bin/bootstrap').run();
  await require('../src/registry').DependencyRegistry.runApplication(name, sub);
}

/**
 * @param {string} filename
 */
function determineAppFromFile(filename) {
  const [, root] = filename.split(pCwd);
  const [, first] = root.split('/');
  return first === 'src' ? '.' : first;
}

async function computeApps() {
  // Suppress all output
  console.warn = console.debug = console.log = function () { };

  require('@travetto/base/bin/bootstrap'); // Load base transpiler

  // Initialize up to compiler
  const { PhaseManager, ScanApp } = require('@travetto/base');
  await PhaseManager.init('bootstrap', 'compiler').run();

  // Load app files
  ScanApp.requireFiles('.ts', x => {
    return /^([^/]+\/)?(src[\/])/.test(x) && x.endsWith('.ts') && !x.endsWith('d.ts') &&
      fs.readFileSync(x).toString().includes('@Application');
  }); // Only load files that are candidates

  // Get applications
  const res = require('../src/registry').DependencyRegistry.getApplications();

  const items = Promise.all(res.map(async x => ({
    watchable: x.watchable,
    description: x.description,
    standalone: x.standalone,
    params: x.params,
    appRoot: determineAppFromFile(x.target.__filename),
    name: x.name,
    generatedTime: maxTime(await fsLstat(x.target.__filename)),
    filename: x.target.__filename,
    id: x.target.__id
  })));

  let resolved = await items;

  resolved = resolved.sort((a, b) => {
    return a.appRoot === b.appRoot ? a.name.localeCompare(b.name) : (a.appRoot === '' ? -1 : 1);
  });

  return resolved;
}

/**
 * Re-implement fork b/c the cli may not be installed, but this is used by the vscode plugin
 */
function fork(cmd, args) {
  return new Promise((resolve, reject) => {
    const text = [];
    const err = [];
    const proc = child_process.spawn(process.argv0, [cmd, ...(args || [])], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      shell: false
    });
    proc.stdout.on('data', v => text.push(v));
    proc.stderr.on('data', v => err.push(v));
    proc.on('exit', v => {
      if (v === 0) {
        resolve(Buffer.concat(text).toString());
      } else {
        reject(Buffer.concat(err).toString());
      }
    });
  });
}

async function getCachedAppList() {
  const { AppCache } = require('@travetto/base/bootstrap/cache'); // Should not init the app, only load cache
  try {
    // Read cache it
    let text;
    if (!AppCache.hasEntry(cacheConfig)) {
      text = await fork(path.resolve(__dirname, 'find-apps'));
      AppCache.writeEntry(cacheConfig, text);
    } else {
      text = AppCache.readEntry(cacheConfig);
    }
    const res = JSON.parse(text);

    for (const el of res) {
      const elStat = (await fsLstat(el.filename).catch(e => delete el.generatedTime));
      // invalidate cache if changed
      if (!el.generatedTime || maxTime(elStat) > el.generatedTime) {
        AppCache.removeExpiredEntry(cacheConfig, true);
        return getCachedAppList();
      }
    }
    return res;
  } catch (e) {
    AppCache.removeExpiredEntry(cacheConfig, true);
    throw e;
  }
}

module.exports = {
  handleFailure,
  runApp,
  cacheConfig,
  getAppList,
  getParamType,
  getAppByName,
  determineAppFromFile,
  computeApps
};