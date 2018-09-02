#!/usr/bin/env node

const fs = require('fs');
const rel = `${process.cwd()}/node_modules/@travetto/cli/bin/travetto.js`;

const hasLocal = fs.existsSync(rel);
const isLocal = __filename === rel;

if (!hasLocal || !isLocal) {
  const Module = require('module');
  const og = Module._load;
  Module._load = function(req, parent) {
    if (req.startsWith('@travetto/cli')) {
      if (!hasLocal) { // Map all @travetto/cli calls to root of global package
        req = `${__dirname}/../${req.split('@travetto/cli')[1]}`.replace(/[\\\/]+/g, '/');
      } else { // Rewrite @travetto/cli to map to local folder, when calling globally
        req = `${process.cwd()}/node_modules/${req}`;
      }
    }
    return og.call(Module, req, parent);
  };
}

require('@travetto/cli/src')(process.argv);