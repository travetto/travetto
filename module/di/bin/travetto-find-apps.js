//@ts-check
//@ts-ignore
const path = require('path')
const fs = require('fs');
const util = require('util');
const config = module.exports.CACHE_FILE = 'di-app-cache.json';
const pcwd = process.cwd().replace(/[\\\/]+/g, '/');

function maxTime(stat) {
  return Math.max(stat.ctimeMs, stat.mtimeMs); // Do not include atime
}

const fsLstat = util.promisify(fs.lstat);

/**
 * 
 * @param {string} filename 
 */
function getApp(filename) {
  const [, root] = filename.split(pcwd);
  const [, first,] = root.split('/');
  return first === 'src' ? '' : first;
}

async function getApps() {
  // Suppress all output
  const og = console.log;
  console.warn = console.debug = console.log = function () { };

  const { Env } = require('@travetto/base/src/env');

  await require('@travetto/base/bin/bootstrap'); // Load base transpiler

  //Initialize upto compiler
  const { PhaseManager } = require('@travetto/base/src/phase');
  const mgr = new PhaseManager('bootstrap');
  mgr.load('compiler');
  await mgr.run();

  //Load app files
  const { ScanApp } = require('@travetto/base/src/scan-app');

  ScanApp.requireFiles('.ts', x =>
    (/^(src[\/])/.test(x) || /^[^\/]+[\/]src[\/]/.test(x)) && x.endsWith('.ts') && !x.endsWith('d.ts') &&
    fs.readFileSync(x).toString().includes('@Application')); // Only load files that are candidates

  let registryPath = '../src/registry';

  //Handle weirdness of symlinks on windows
  if (Env.frameworkDev === 'win32') {
    registryPath = path.resolve(process.env.__dirname, registryPath);
  }

  //Get applications
  const res = require(registryPath).DependencyRegistry.getApplications();

  const items = Promise.all(res.map(async x => ({
    watchable: x.watchable,
    description: x.description,
    params: x.params,
    appRoot: getApp(x.target.__filename),
    name: x.name,
    generatedTime: maxTime(await fsLstat(x.target.__filename)),
    filename: x.target.__filename,
    id: x.target.__id
  })));

  let resolved = await items;

  resolved = resolved.sort((a, b) => {
    return a.appRoot === b.appRoot ? a.name.localeCompare(b.name) : (a.appRoot === '' ? -1 : 1);
  });


  og.call(console, JSON.stringify(resolved));
}

function fork(cmd, args) {
  const { Env } = require('@travetto/base/src/env');

  return new Promise((resolve, reject) => {
    let text = [];
    let err = [];
    const proc = require('child_process').spawn(process.argv0, [cmd, ...(args || [])], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      shell: false,
      env: {
        ...process.env,
        ...(Env.frameworkDev === 'win32' ? { __dirname } : {})
      }
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

module.exports.getCachedAppList = async function getCachedAppList() {
  const { AppCache } = require('@travetto/base/src/cache');
  try {
    //Read cache it
    if (!AppCache.hasEntry(config)) {
      const text = await fork(__filename);
      AppCache.writeEntry(config, text);
    }
    const text = AppCache.readEntry(config);
    const res = JSON.parse(text);

    for (const el of res) {
      const elStat = (await fsLstat(el.filename).catch(e => delete el.generatedTime));
      // invalidate cache if changed
      if (!el.generatedTime || maxTime(elStat) > el.generatedTime) {
        AppCache.removeExpiredEntry(config, true);
        return getCachedAppList();
      }
    }
    return res;
  } catch (e) {
    AppCache.removeExpiredEntry(config, true);
    throw e;
  }
}

//@ts-ignore
if (require.main === module) {
  getApps().catch(err => {
    console.error(err);
    process.exit(1);
  });
}