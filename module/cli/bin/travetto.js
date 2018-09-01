#!/usr/bin/env node

const fs = require('fs');
const rel = `${process.cwd()}/node_modules/.bin/travetto`;

if (!fs.existsSync(rel)) {
  const Module = require('module');
  const og = Module._load;
  Module._load = function(req, parent) {
    if (req.startsWith('@travetto/cli')) {
      req = `${__dirname}/../${req.split('@travetto/cli')[1]}`.replace(/[\\\/]+/g, '/');
    }
    return og.call(Module, req, parent);
  };
}

require('@travetto/cli')(process.argv);