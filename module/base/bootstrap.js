const fs = require('fs');
const ts = require('typescript');

//Simple bootstrap to load compiler
require.extensions['.ts'] = function load(m, tsf) {
  const content = ts.transpile(fs.readFileSync(tsf, 'utf-8'));
  return m._compile(content, tsf.replace(/\.ts$/, '.js'));
};

require('./src/stacktrace'); //Prep stack traces
require('./src/env'); //Setup env properly