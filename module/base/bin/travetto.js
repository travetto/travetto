#!/usr/bin/env node

const fs = require('fs');
const ts = require('typescript');
const os = require('os');

//Simple bootstrap to load compiler
const cwd = (process.env.INIT_CWD || process.cwd()).replace(/[\/\\]+$/, '');
const json = ts.readJsonConfigFile(`${cwd}/tsconfig.json`, ts.sys.readFile);
const opts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, cwd).options;

process.env.TS_CWD = cwd;

if (!process.env.TS_CACHE_DIR) {
  process.env.TS_CACHE_NAME = cwd.replace(/[\/\\.]/g, '_');
  process.env.TS_CACHE_DIR = `${os.tmpdir()}/${process.env.TS_CACHE_NAME}`;
}

const CACHE_DIR = process.env.TS_CACHE_DIR;
const CACHE_SEP = (process.env.TS_CACHE_SEP = process.env.TS_CACHE_SEP || '~');
const CACHE_SEP_RE = new RegExp(CACHE_SEP, 'g');

// Delete old cached files
const LOADED = {};
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR);
}

for (const f of fs.readdirSync(CACHE_DIR)) {
  const full = cwd + f.replace(CACHE_SEP_RE, '/').replace(/@ts$/, '.ts');
  const rel = `${CACHE_DIR}/${f}`;
  const stat = LOADED[rel] = fs.statSync(rel);
  const fullStat = fs.statSync(full);
  if (stat.ctimeMs < fullStat.ctimeMs || stat.mtimeMs < fullStat.mtimeMs || stat.atime < fullStat.mtime) {
    fs.unlinkSync(rel);
    delete LOADED[rel];
  }
}

// Cache on require
require.extensions['.ts'] = function load(m, tsf) {
  const name = `${CACHE_DIR}/${tsf.replace(cwd, '').replace(/[\/\\]/g, CACHE_SEP).replace(/.ts$/, '@ts')}`;
  let content;
  if (!LOADED[name]) {
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