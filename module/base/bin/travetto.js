#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

//Simple bootstrap to load compiler
const { Env } = require('../src/env');
const { AppCache } = require('../src/cache');
const cwd = Env.cwd;

const json = ts.readJsonConfigFile(`${cwd}/tsconfig.json`, ts.sys.readFile);
const opts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, cwd).options;

AppCache.init();

//Rewrite Module for local development
if (Env.frameworkDev) {
  const og = Module._load.bind(Module);
  Module._load = (request, parent) => {
    if (request.startsWith('@travetto')) {
      request = `${cwd}/node_modules/${request}`;
    } else if (request.startsWith('.') && parent.filename.includes('travetto/module') && !parent.filename.startsWith(cwd)) {
      const p = path.resolve(path.dirname(parent.filename), request);
      request = `${cwd}/node_modules/@travetto/${p.split('travetto/module/').pop()}`;
    }
    return og.apply(null, [request, parent]);
  };
}

// Cache on require
require.extensions['.ts'] = function load(m, tsf) {
  const name = tsf.replace(/[\\\/]/g, path.sep);

  let content;
  if (!AppCache.hasEntry(name)) {
    content = ts.transpile(fs.readFileSync(tsf, 'utf-8'), opts);
    AppCache.writeEntry(name, content);
  } else {
    content = AppCache.readEntry(name);
  }
  return m._compile(content, tsf.replace(/\.ts$/, '.js'));
};

const { PhaseManager } = require('../src/phase');
const mgr = new PhaseManager('bootstrap');
mgr.load();

if (require.main === module) {
  mgr.run();
} else {
  module.exports = mgr;
}