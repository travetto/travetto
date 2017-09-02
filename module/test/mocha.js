#!/usr/bin/env node

let fs = require('fs');

let setup = [];
let extra = [];
let root = process.cwd();
let ui = `${__dirname}/src/user-interface`;

if (process.env.TIMEOUT) {
  extra.push('--timeout', process.env.TIMEOUT);
}

try {
  if (!!fs.statSync(`${root}/test/setup.ts`)) {
    setup = ['--require', `test/setup.ts`];
  }
} catch (e) { }

try {
  if (!!fs.statSync(`${root}/test/user-interface.ts`)) {
    ui = `${root}/test/user-interface`;
  }
} catch (e) { }

process.argv = [
  process.argv[0],
  'mocha',
  ...(process.env.NODE_FLAGS || '').split(' '),
  '--require', `${__dirname}/bootstrap`,
  '--ui', ui,
  ...setup,
  ...extra,
  ...process.argv.slice(2)
].filter(x => !!x);

process.env.env = 'test';

require(`${root}/node_modules/mocha/bin/_mocha`);