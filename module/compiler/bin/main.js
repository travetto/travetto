#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

let opts;
for (const el of ['compile.ts', 'utils.ts']) {
  const inputFile = path.resolve(__dirname, '..', 'support', 'bin', el);
  const outputFile = inputFile.replace(/[.]ts$/, '.js').replace(/bin/, '.bin');
  if (!fs.existsSync(outputFile) || (fs.statSync(outputFile).mtimeMs < fs.statSync(inputFile).mtimeMs)) {
    const ts = require('typescript');
    opts ??= ts.readConfigFile(path.resolve(__dirname, '..', '..', 'tsconfig.trv.json'), ts.sys.readFile).config?.compilerOptions;
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, ts.transpile(fs.readFileSync(inputFile, 'utf8'), opts, inputFile));
  }
}

module.exports = require('../support/.bin/compile');