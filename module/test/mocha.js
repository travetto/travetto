#!/usr/bin/env node

let fs = require('fs');

let hasInit = false;
let hasSetup = false;

try {
  hasInit = !!fs.statSync(process.cwd() + '/node_modules/@encore/init');
} catch (e) {}

try {
  hasSetup = !!fs.statSync(process.cwd() + "/src/test/setup.ts");
} catch (e) {}


process.args.unshift(
  '--ui', 
    '@encore/test/src/lib/user-interface', 
  '--delay', 
  '--require',
    `node_modules/@encore/${hasInit?'init/bootstrap.js':'base/src/lib/require-ts.js'}`,
  ...(hasSetup ? [
    '--require', 
      'src/test/setup'
    ] : [])
);

process.env.auto = true;
process.env.env = process.env.env || 'test'; 

require('mocha/bin/mocha');