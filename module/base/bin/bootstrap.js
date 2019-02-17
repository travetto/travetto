#!/usr/bin/env node

//@ts-check
const path = require('path');
const Module = require('module');

// @ts-ignore
let ts = global.ts = new Proxy({}, {
  get(t, p, r) { ts = global['ts'] = require('typescript'); return ts[p]; }
});

//Simple bootstrap to load compiler
const { FsUtil } = require('../src/bootstrap/fs-util');
const { Env, showEnv } = require('../src/bootstrap/env');
const { AppCache } = require('../src/bootstrap/cache');
const cwd = Env.cwd;

AppCache.init();

// Show init
showEnv();

// @ts-ignore
const ogModuleLoad = Module._load.bind(Module);

function moduleLoaderHandler(request, parent) {

  const mod = ogModuleLoad.apply(null, [request, parent]);

  if (!parent.loaded && (!mod || !mod._$TRV)) {
    let p;
    try {
      // @ts-ignore      
      p = Module._resolveFilename(request, parent);
    } catch (err) {
      // Ignore if we can't resolve
    }
    if (p && p.endsWith('.ts')) {
      throw new Error(`Unable to load ${p}, most likely a cyclical dependency`);
    }
  }

  return mod;
}

let moduleLoader = moduleLoaderHandler;

if (process.env.TRV_FRAMEWORK_DEV) {
  moduleLoader = (request, parent) => {
    const root = path.dirname(parent.filename);
    const resolved = path.resolve(root, request);

    if (/^[.\/]/.test(request) || request.startsWith('@travetto')) { // If relative or framework
      request = FsUtil.resolveFrameworkDevFile(request.startsWith('@travetto') ? request : resolved);
    }

    return moduleLoaderHandler(request, parent);
  }
}

// @ts-ignore, catch cyclical dependencies
Module._load = moduleLoader;

let opts;

// Cache on require
require.extensions['.ts'] = function load(m, tsf) {
  const name = FsUtil.toUnix(tsf);

  let content;
  if (!AppCache.hasEntry(name)) {
    if (!opts) {
      const json = ts.readJsonConfigFile(`${cwd}/tsconfig.json`, ts.sys.readFile);
      opts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, cwd).options;
    }
    content = ts.transpile(FsUtil.prepareTranspile(tsf), opts);
    AppCache.writeEntry(name, content);
  } else {
    content = AppCache.readEntry(name);
  }

  // @ts-ignore
  const r = m._compile(content, tsf.replace(/\.ts$/, '.js'));
  return r;
};

const { PhaseManager } = require('../src/phase');
const mgr = new PhaseManager('bootstrap');
mgr.load();

module.exports = mgr;

// @ts-ignore
if (require.main === module) {
  mgr.run();
}