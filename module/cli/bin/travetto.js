#!/usr/bin/env node

let Util;

const rel = `${process.cwd()}/node_modules/@travetto/cli/bin/travetto`;
if (rel !== __filename) {
  try {
    Util = require(rel).Util;
  } catch (e) {}
}
if (!Util) {
  Util = require('../src/util').Util;
}

Util.run(process.argv);