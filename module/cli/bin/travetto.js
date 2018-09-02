#!/usr/bin/env node

const fs = require('fs');
const rel = `${process.cwd()}/node_modules/.bin/travetto`;

if (!fs.existsSync(rel) || __filename !== rel) {
  const Module = require('module');
  const og = Module._load;
  Module._load = function(req, parent) {
    if (req.startsWith('@travetto/cli')) {
      if (rel === __filename) {
        req = `${__dirname}/../${req.split('@travetto/cli')[1]}`.replace(/[\\\/]+/g, '/');
      } else {
        req = `${process.cwd()}/node_modules/${req}`;
      }
    }
    return og.call(Module, req, parent);
  };
}

require('@travetto/cli/src')(process.argv);