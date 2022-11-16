#!/usr/bin/env node
const path = require('path');
const { rmSync } = require('fs');
try { require(path.resolve('.env')); } catch { }

const compile = !/^(1|yes|on|true)/i.test(process.env.TRV_COMPILED ?? '');
const outputFolder = (process.env.TRV_OUTPUT || path.resolve('.trv_output')).replaceAll('\\', '/');
const compilerFolder = (process.env.TRV_COMPILER || path.resolve('.trv_compiler')).replaceAll('\\', '/');

(function go(cmd, ...args) {
  const { boot } = require('@travetto/boot/bin/bootstrap');

  switch (cmd) {
    case 'watch': return boot({ compile, outputFolder, compilerFolder, watch: true });
    case 'clean': {
      if (args.length === 0) {
        rmSync(outputFolder, { force: true, recursive: true });
        rmSync(compilerFolder, { force: true, recursive: true });
        return;
      }
      break;
    }
  }
  return boot({ compile, outputFolder, compilerFolder, main: '@travetto/cli/support/main.cli' });
})(...process.argv.slice(2));