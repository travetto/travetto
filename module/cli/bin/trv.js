#!/usr/bin/env node

// @ts-check
const cmdMapping = { build: 'build', clean: 'clean', watch: 'watch', manifest: 'manifest', main: 'main' };
const op = cmdMapping[process.argv[2]];
require('@travetto/compiler/bin/main')
  .exec(op, op === 'main' ? process.argv[3].replace(/[.]ts$/, '.js') : '@travetto/cli/support/main.cli.js')
  .then(loc => loc ? import(process.env.TRV_MAIN = loc) : undefined);