#!/usr/bin/env node

const fs = require('fs');
const ts = require('typescript');

//Simple bootstrap to load compiler
const json = ts.readJsonConfigFile(`${process.cwd()}/tsconfig.json`, ts.sys.readFile);
const opts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, process.cwd()).options;

const CACHE_DIR = (process.env.TS_CACHE_DIR = process.env.TS_CACHE_DIR || `${process.cwd()}/build`);
const CACHE_SEP = (process.env.TS_CACHE_SEP = process.env.TS_CACHE_SEP || `~`);
const CACHE_SEP_RE = new RegExp(CACHE_SEP, 'g');

// Delete old cached files
for (const f of fs.readdirSync(CACHE_DIR)) {
  const full = f.replace(CACHE_SEP_RE, '/');
  if (fs.statSync(`${CACHE_DIR}/${f}`).ctimeMs < fs.statSync(full).ctimeMs) {
    fs.unlinkSync(`${CACHE_DIR}/${f}`);
  }
}

// Cache on require
require.extensions['.ts'] = function load(m, tsf) {
  const name = `${CACHE_DIR}/${tsf.replace(/[\/\\]/g, CACHE_SEP)}`;
  let content;
  if (!fs.existsSync(name)) {
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