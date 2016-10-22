#!/usr/bin/env node

let fs = require('fs');

let hasInit = false;
let hasSetup = false;

try {
  hasInit = !!fs.statSync(process.cwd() + '/node_modules/@encore/init');
} catch (e) { }

try {
  hasSetup = !!fs.statSync(process.cwd() + "/src/test/setup.ts");
} catch (e) { }


process.argv = [
  'mocha',
  '--delay',
  '--require',
  `node_modules/@encore/${hasInit ? 'init/bootstrap.js' : 'base/src/lib/require-ts.js'}`,
  '--ui',
  '@encore/test/src/lib/user-interface',
  ...(hasSetup ? [
    '--require',
    'src/test/setup'
  ] : []),
  ...process.argv.slice(2)
];

process.env.auto = true;
process.env.env = process.env.env || 'test';

console.log(process.argv);

require(process.cwd() + '/node_modules/mocha/bin/mocha');