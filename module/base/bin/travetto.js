#!/usr/bin/env node

const fs = require('fs');
const ts = require('typescript');

//Simple bootstrap to load compiler
const json = ts.readJsonConfigFile(`${process.cwd()}/tsconfig.json`, ts.sys.readFile);
const opts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, process.cwd()).options;

require.extensions['.ts'] = function load(m, tsf) {
  const content = ts.transpile(fs.readFileSync(tsf, 'utf-8'), opts);
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