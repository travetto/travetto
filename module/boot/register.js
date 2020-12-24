#!/usr/bin/env node

/**
 * Initialization function for all applications
 */
function init() {
  const cwd = process.cwd();
  try { require(`${cwd}/.env`); } catch { }
  process.env.TRV_DEV_ROOT && require(`${process.env.TRV_DEV_ROOT}/dev-register`);
  require('@travetto/boot/src/compile').CompileUtil.init();
}

if (!global.trvInit) { // Register once, and mark
  init();
}

module.exports = global.trvInit;