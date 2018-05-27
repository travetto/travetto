#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

//Simple bootstrap to load compiler
const { AppEnv: { cwd, cache } } = require('../src/env');
const json = ts.readJsonConfigFile(`${cwd}/tsconfig.json`, ts.sys.readFile);
const opts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, cwd).options;

// Delete old cached files
const CACHE = cache.init();

// Cache on require
require.extensions['.ts'] = function load(m, tsf) {
  const name = cache.toEntryName(tsf);

  let content;
  if (!CACHE[name]) {
    content = ts.transpile(fs.readFileSync(tsf, 'utf-8'), opts);
    fs.writeFileSync(name, content);
  } else {
    content = fs.readFileSync(name).toString();
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