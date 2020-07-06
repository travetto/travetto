#!/usr/bin/env node

/**
 * Initialization function for all applications
 */
function init() {
  const cwd = process.cwd();
  try { require(`${cwd}/.trv_env`); } catch { } // Load the .env.js file
  const root = (process.env.TRV_BOOT || '').replace(/^[.]/, cwd) || __dirname;
  require(`${root}/src/compile`).CompileUtil.init();
}

if (!global.trvInit) { // Register once, and mark
  init();
}

module.exports = global.trvInit;