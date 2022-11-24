#!/usr/bin/env node

const fs = require('fs');
const { createRequire } = require('module');
const path = require('path');

let _opts;
let pkg = false;

const NAME = '@travetto/precompiler';

function getOpts() {
  const ts = require('typescript');
  const loc = path.resolve(__dirname, '..', 'tsconfig.trv.json');
  if (_opts === undefined) {
    _opts = ts.readConfigFile(loc, ts.sys.readFile).config?.compilerOptions;
    try {
      const { type } = require(`${process.cwd()}/package.json`);
      if (type) {
        _opts.module = type.toLowerCase() === 'commonjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext;
      }
    } catch { }
  }
  return _opts;
}

function writePackageJson(outputFolder, files, opts) {
  if (!pkg) {
    const ts = require('typescript');
    const isEsm = opts.module !== ts.ModuleKind.CommonJS;
    pkg = require('../package.json');
    fs.writeFileSync(`${outputFolder}/package.json`, JSON.stringify({
      ...pkg,
      files: files.map(x => x.replace('.ts', '.js')),
      name: NAME,
      main: 'compile.js',
      type: isEsm ? 'module' : 'commonjs'
    }, null, 2));
  }
}

function transpile(inputFile, outputFile, opts) {
  const ts = require('typescript');

  const content = ts.transpile(fs.readFileSync(inputFile, 'utf8'), opts, inputFile)
    .replace(/^(import.*?from '[.][^']+)(')/mg, (_, a, b) => `${a}.js${b}`);

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, content);
}

async function compile({ compilerFolder, ...rest }) {
  const root = path.resolve(__dirname, '../support/bin');
  const output = path.resolve(compilerFolder, `node_modules/${NAME}`);
  const files = fs.readdirSync(root);
  for (const el of files) {
    const inputFile = path.resolve(root, el);
    const outputFile = path.resolve(output, el.replace(/[.]ts$/, '.js'));

    if (!fs.existsSync(outputFile) || (fs.statSync(outputFile).mtimeMs < fs.statSync(inputFile).mtimeMs)) {
      const opts = getOpts();
      transpile(inputFile, outputFile, opts);
      writePackageJson(output, files, opts);
    }
  }
  const isEsm = require(`${output}/package.json`).type === 'module';
  const req = createRequire(`${compilerFolder}/node_modules`);
  const loc = req.resolve(NAME);

  const mod = await (isEsm ? import(loc) : require(loc));
  return mod.compile({ compilerFolder, ...rest });
}

if (process.env.TRV_OUTPUT !== process.cwd().replaceAll('\\', '/')) {
  module.exports = compile;
} else {
  module.exports = async () => { };
}