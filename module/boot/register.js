#!/usr/bin/env node

/**
 * Initialization function for all applications
 */
function init() {
  try { require(`${process.cwd()}/.env`); } catch { }
  (process.env.TRV_REQUIRES || '').split(',').filter(x => !!x).forEach(m => require(m));
  require('@travetto/boot/src/internal/compile').CompileUtil.init();
  process.env.TRV_ENTRY && require(process.env.TRV_ENTRY).entry(...process.argv.slice(2));
}

if (!global.trvInit) { // Register once, and mark
  init();
}

module.exports = global.trvInit;