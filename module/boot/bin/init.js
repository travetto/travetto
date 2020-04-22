#!/usr/bin/env node
function init() {
  const cwd = process.cwd();
  const root = !process.env.TRV_DEV ? '..' :
    cwd.includes('/module/boot') ?
      cwd : `${cwd}/node_modules/@travetto/boot`;
  require(`${root}/src/register`).RegisterUtil.init();
}

if (!global.trvInit) { // Register once
  init();
}

module.exports = global.trvInit;