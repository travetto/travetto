#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

if (process.env.TRV_OUTPUT !== process.cwd().replaceAll('\\', '/')) {
  let opts;
  for (const el of ['compile', 'utils']) {
    const inputFile = path.resolve(__dirname, '../support/bin', `${el}.ts`);
    const outputFile = path.resolve(__dirname, '../support/.bin', `${el}.js`);
    if (!fs.existsSync(outputFile) || (fs.statSync(outputFile).mtimeMs < fs.statSync(inputFile).mtimeMs)) {
      const ts = require('typescript');
      opts ??= ts.readConfigFile(path.resolve(__dirname, '..', '..', 'tsconfig.trv.json'), ts.sys.readFile).config?.compilerOptions;
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      fs.writeFileSync(outputFile, ts.transpile(fs.readFileSync(inputFile, 'utf8'), opts, inputFile));
    }
  }

  module.exports = require('../support/.bin/compile');
} else {
  module.exports = require('../support/bin/compile');
}