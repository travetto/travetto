#!/usr/bin/env node

//@ts-check
const fs = require('fs');
const path = require('path');
const Module = require('module');
// @ts-ignore
const ts = global.ts = require('typescript');

//Simple bootstrap to load compiler
const { Env, showEnv } = require('../src/env');
const { resolveFrameworkFile } = require('../src/app-info');
const { AppCache } = require('../src/cache');
const cwd = Env.cwd;

AppCache.init();

// Show init
showEnv();

//Rewrite Module for local development
if (Env.frameworkDev) {
  const parDir = path.resolve(path.dirname(path.dirname(cwd)), 'module');
  // @ts-ignore
  const og = Module._load.bind(Module);
  // @ts-ignore
  Module._load = (request, parent) => {
    const root = path.dirname(parent.filename);
    if (request.startsWith('@travetto')) { // Handle import directly
      request = `${cwd}/node_modules/${request}`;
    } else if (request.startsWith('.') && root.startsWith(parDir) && !root.startsWith(cwd)) { // Handle relative and sub
      const relativeRoot = root.split(parDir).pop();
      request = path.resolve(`${cwd}/node_modules/@travetto/${relativeRoot}`, request);
    }
    request = resolveFrameworkFile(request);
    const mod = og.apply(null, [request, parent]);
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
  };
}

let opts;

// Cache on require
require.extensions['.ts'] = function load(m, tsf) {
  const name = tsf.replace(/[\\\/]/g, path.sep);

  let content;
  if (!AppCache.hasEntry(name)) {
    if (!opts) {
      const json = ts.readJsonConfigFile(`${cwd}/tsconfig.json`, ts.sys.readFile);
      opts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, cwd).options;
    }
    content = ts.transpile(`${fs.readFileSync(tsf, 'utf-8')};\nexport const _$TRV = 1;`, opts);
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