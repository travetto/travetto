const sourcemap = require('source-map-support');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const glob = require('glob');

const cwd = process.cwd();
const tsOptions = getOptions(path.join(cwd, 'tsconfig.json'));

const dataUriRe = /data:application\/json[^,]+base64,/;
const sourceMaps = {};
let transformers = {};

function registerTransformers() {
  const transformers = {}
  // Load transformers
  for (const phase of ['before', 'after']) {
    for (const f of glob.sync(`${process.cwd()}/**/transformer-${phase}*.ts`)) {
      const res = require(path.resolve(f));
      if (res) {
        if (!transformers[phase]) {
          transformers[phase] = [];
        }
        for (const k of Object.keys(res)) {
          transformers[phase].push(res[k]);
        }
      }
    }
  }
  return require('./transform-ts').createCustomTransformers(transformers);
}

function getOptions(path) {
  const out = require(path);
  while (out.extends) {
    const base = path.split('tsconfig.json')[0];

    path = out.extends;
    if (!path.startsWith('/')) {
      path = base + '/' + path.replace(/^.\//, '');
      delete out.extends;
    }
    const outNext = require(path);
    Object.assign(out, outNext, { compilerOptions: Object.assign(out.compilerOptions || {}, outNext.compilerOptions) });
  }

  const res = ts.convertCompilerOptionsFromJson(out.compilerOptions, process.cwd());
  return res.options;
}

function transpile(input, compilerOptions, fileName, transformers) {
  const output = ts.transpileModule(input, { compilerOptions, fileName, reportDiagnostics: false, transformers });
  // addRange correctly handles cases when wither 'from' or 'to' argument is missing
  ts.addRange(undefined, output.diagnostics);
  return output.outputText;
}

sourcemap.install({ retrieveSourceMap: (path) => sourceMaps[path] });

// Wrap sourcemap tool
const prep = Error.prepareStackTrace;
Error.prepareStackTrace = function (a, stack) {
  const res = prep(a, stack);
  const parts = res.split('\n');
  return [parts[0], ...parts.slice(1)
    .filter(l =>
      l.indexOf('require-ts.js') < 0 &&
      l.indexOf('module.js') < 0 &&
      l.indexOf('source-map-support.js') < 0 &&
      (l.indexOf('node_modules') > 0 ||
        (l.indexOf('(native)') < 0 && (l.indexOf(cwd) < 0 || l.indexOf('.js') < 0))))
  ].join('\n');
}

require.extensions['.ts'] = function load(m, tsf) {
  const jsf = tsf.replace(/\.ts$/, '.js');
  const parts = tsf.split('/');
  const name = parts.pop();
  const folder = parts.pop();
  const content = transpile(fs.readFileSync(tsf, 'utf-8'), tsOptions, `${folder}/${name}`, transformers);
  const map = new Buffer(content.split(dataUriRe)[1], 'base64').toString()
  sourceMaps[jsf] = { content, url: tsf, map };
  return m._compile(content, jsf);
};

transformers = registerTransformers();