#!/usr/bin/env node
const path = require('path');
const { rmSync } = require('fs');
const { createRequire } = require('module');
try { require(path.resolve('.env')); } catch { }

const compile = !/^(1|yes|on|true)$/i.test(process.env.TRV_COMPILED ?? '');
const outputFolder = (process.env.TRV_OUTPUT || path.resolve('.trv_output')).replaceAll('\\', '/');
const compilerFolder = (process.env.TRV_COMPILER || path.resolve('.trv_compiler')).replaceAll('\\', '/');

(async function go(cmd, ...args) {
  const build = await require('@travetto/compiler/bin/main');

  switch (cmd) {
    case 'watch': return build({ compile, outputFolder, compilerFolder, watch: true });
    case 'clean': {
      if (args.length === 0) {
        rmSync(outputFolder, { force: true, recursive: true });
        rmSync(compilerFolder, { force: true, recursive: true });
        console.log(`Cleaned ${process.cwd()}`);
        return;
      }
      break;
    }
  }
  await build({ compile, outputFolder, compilerFolder });

  const req = createRequire(`${outputFolder}/node_modules`);
  process.env.TRV_MAIN = req.resolve('@travetto/cli/support/main.cli.js');
  return await import(process.env.TRV_MAIN);
})(...process.argv.slice(2));