const fs = require('fs');
const ts = require('typescript');

//Simple bootstrap to load compiler
require.extensions['.ts'] = function load(m, tsf) {
  return m._compile(ts.transpile(fs.readFileSync(tsf, 'utf-8')), tsf.replace(/\.ts$/, '.js'));
};