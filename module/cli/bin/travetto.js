#!/usr/bin/env node

const fs = require('fs');
const rel = `${root}/bin/travetto.js`;

if (rel === __filename || !fs.existsSync(rel)) {
  const Module = require('module');
  const og = Module._load;
  Module._load = function(req, parent) {
    if (req.startsWith('@travetto/cli')) {
      req = `${__dirname}/../${req.split('@travetto/cli')[1]}`.replace(/[\\\/]+/g, '/');
    }
    return og.call(Module, req, parent);
  };
}

require('@travetto/cli/src/util').Util.run(process.argv);