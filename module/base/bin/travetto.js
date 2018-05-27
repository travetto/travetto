#!/usr/bin/env node

const fs = require('fs');
const ts = require('typescript');
const os = require('os');

//Simple bootstrap to load compiler
const { AppEnv: { cwd, cache } } = require('../src/env');
const json = ts.readJsonConfigFile(`${cwd}/tsconfig.json`, ts.sys.readFile);
const opts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, cwd).options;

// Delete old cached files
const CACHE = {};
if (!fs.existsSync(cache.dir)) {
  fs.mkdirSync(cache.dir);
}

for (const f of fs.readdirSync(cache.dir)) {
  const full = cwd + f.replace(cache.sepRe, '/').replace(/@ts$/, '.ts');
  const rel = `${cache.dir}/${f}`;
  const stat = CACHE[rel] = fs.statSync(rel);
  const fullStat = fs.statSync(full);
  if (stat.ctimeMs < fullStat.ctimeMs || stat.mtimeMs < fullStat.mtimeMs || stat.atime < fullStat.mtime) {
    fs.unlinkSync(rel);
    delete CACHE[rel];
  }
}

// Cache on require
require.extensions['.ts'] = function load(m, tsf) {
  const name = `${cache.dir}/${tsf.replace(cwd, '').replace(/[\/\\]/g, cache.sep).replace(/.ts$/, '@ts')}`;
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