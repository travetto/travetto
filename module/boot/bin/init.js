#!/usr/bin/env node

/**
 * Initialization function for all applications, this provides the
 * necessary structure for handling standard dev and framework dev
 */
function init() {
  const cwd = process.cwd();
  const root = !process.env.TRV_DEV ? '..' : // Standard
    cwd.includes('/module/boot') ? cwd : // In boot module
      !/\/(module|sample)\//.test(cwd) ? `${cwd}/module/boot` : // At root
        `${cwd}/node_modules/@travetto/boot`; // Everywhere else
  require(`${root}/src/register`).RegisterUtil.init();
}

if (!global.trvInit) { // Register once, and mark
  init();
}

module.exports = global.trvInit;