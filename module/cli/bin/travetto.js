#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

let root = '';
const rel = `${root}/bin/travetto.js`;

if (rel !== __filename && fs.existsSync(rel)) {
  root = `${process.cwd()}/node_modules/@travetto/cli`;
} else {
  console.log('Not installed locally, using global installation');
  root = `${path.dirname(__dirname)}`;
}

const req = module.require;
module.require = function(...args) {
  if (args[0].startsWith('@travetto/cli')) {
    args[0] = `${root}/${args[0].split('@travetto/cli')[1]}`.replace(/\/+/g, '/');
  }
  return req.apply(module, args);
};

require('@travetto/cli/src/util.js').Util.run(process.argv);