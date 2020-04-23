#!/usr/bin/env node
function init() {
  const cwd = process.cwd();
  const root = !process.env.TRV_DEV ? '..' : // Standard
    cwd.includes('/module/boot') ? cwd : // In boot module
      !/\/(module|sample)\//.test(cwd) ? `${cwd}/module/boot` : // At root
        `${cwd}/node_modules/@travetto/boot`; // Everywhere else
  require(`${root}/src/register`).RegisterUtil.init();
}

if (!global.trvInit) { // Register once
  init();
}

module.exports = global.trvInit;