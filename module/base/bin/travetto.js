#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

//Simple bootstrap to load compiler
const { AppEnv: { cwd } } = require('../src/env');
const { AppCache } = require('../src/cache');

const json = ts.readJsonConfigFile(`${cwd}/tsconfig.json`, ts.sys.readFile);
const opts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, cwd).options;

AppCache.init();

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