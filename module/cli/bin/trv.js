#!/usr/bin/env node

// @ts-check
const cmdMapping = { build: 'build', clean: 'clean', watch: 'watch' };

require('@travetto/compiler/bin/main')
  .exec(cmdMapping[process.argv[2]], '@travetto/cli/support/main.cli.js')
  .then(loc => loc ? import(process.env.TRV_MAIN = loc) : undefined);