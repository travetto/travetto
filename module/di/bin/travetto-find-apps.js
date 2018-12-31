#!/usr/bin/env node

//@ts-check

const fs = require('fs');
const config = module.exports.CACHE_FILE = 'di-app-cache.json';
const stat = require('util').promisify(fs.lstat);

function maxTime(stat) {
  return Math.max(stat.ctimeMs, stat.mtimeMs); // Do not include atime
}

async function getApps() {
  // Suppress all output
  const og = console.log;
  console.warn = console.debug = console.log = function () { };

  await require('@travetto/base/bin/bootstrap'); // Load base transpiler

  //Initialize upto compiler
  const { PhaseManager } = require('@travetto/base/src/phase');
  const mgr = new PhaseManager('bootstrap');
  mgr.load('compiler');
  await mgr.run();

  //Load app files
  const { ScanApp } = require('@travetto/base/src/scan-app');
  ScanApp.requireFiles('.ts', x =>
    /^(src|e2e)\/.*[^.][^d][.]ts$/.test(x) &&
    fs.readFileSync(x).toString().includes('@Application')); // Only load files that are candidates

  //Get applications
  const res = require('../src/registry').DependencyRegistry.getApplications();

  const items = Promise.all(res.map(async x => ({
    watchable: x.watchable,
    description: x.description,
    params: x.params,
    name: x.name,
    generatedTime: maxTime(await stat(x.target.__filename)),
    filename: x.target.__filename,
    id: x.target.__id
  })));

  og.call(console, JSON.stringify(await items));
}

function fork(cmd, args) {
  return new Promise((resolve, reject) => {
    let text = [];
    let err = [];
    const proc = require('child_process').fork(cmd, args || [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
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
      const elStat = await stat(el.filename);
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