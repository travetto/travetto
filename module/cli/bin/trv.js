#!/usr/bin/env node
const path = require('path');
const { rmSync } = require('fs');
try { require(path.resolve('.env')); } catch { }

const compile = !/^(1|yes|on|true)$/i.test(process.env.TRV_COMPILED ?? '');
const outputFolder = (process.env.TRV_OUTPUT || path.resolve('.trv_output')).replaceAll('\\', '/');
const compilerFolder = (process.env.TRV_COMPILER || path.resolve('.trv_compiler')).replaceAll('\\', '/');

(async function go(cmd, ...args) {
  const { compile: build } = require('@travetto/compiler/bin/compile');

  switch (cmd) {
    case 'watch': return build({ compile, outputFolder, compilerFolder, watch: true });
    case 'clean': {
      if (args.length === 0) {
        rmSync(outputFolder, { force: true, recursive: true });
        rmSync(compilerFolder, { force: true, recursive: true });
        return;
      }
      break;
    }
  }
  await build({ compile, outputFolder, compilerFolder });
  process.env.TRV_MAIN = require.resolve('@travetto/cli/support/main.cli');
  return require('@travetto/cli/support/main.cli');
})(...process.argv.slice(2));