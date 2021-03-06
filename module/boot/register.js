#!/usr/bin/env node

/**
 * Initialization function for all applications
 */
function init() {
  try { require(`${process.cwd()}/.env`); } catch { }
  (process.env.TRV_REQUIRES || '').split(',').filter(x => !!x).forEach(m => require(m));
  require('@travetto/boot/src/internal/compile').CompileUtil.init();
  if (require.main === 'module') {
    require(process.argv[2]).main(...process.argv.slice(3));
  }
}

if (!global.trvInit) { // Register once, and mark
  init();
}

module.exports = global.trvInit;