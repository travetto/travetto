#!/usr/bin/env node

let fs = require('fs');

let setup = [];
let root = process.cwd();

try {
  if (!!fs.statSync(`${root}/src/test/setup.ts`)) {
    setup = ['--require', `src/test/setup.ts`];
  }
} catch (e) { }


process.argv = [
  process.argv[0],
  'mocha',
  '--delay',
  '--require',
  `node_modules/@encore/bootstrap/init`,
  '--ui',
  '@encore/test/src/lib/user-interface',
  ...setup,
  ...process.argv.slice(2)
];

process.env.DEFAULT_ENV = 'test';

require(`${root}/node_modules/mocha/bin/mocha`);