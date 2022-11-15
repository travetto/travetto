#!/usr/bin/env node
const { path } = require('@travetto/common');
try { require(path.resolve('.env')); } catch { }
require('@travetto/boot/bin/bootstrap').boot({
  outputFolder: process.env.TRV_OUTPUT || path.resolve('.trv_output'),
  compilerFolder: process.env.TRV_COMPILER || path.resolve('.trv_compiler'),
  compile: !/^(1|yes|on|true)/i.test(process.env.TRV_COMPILED ?? ''),
  watch: /^(1|yes|on|true)/i.test(process.env.TRV_WATCH ?? ''),
  main: '@travetto/cli/support/main.cli'
});