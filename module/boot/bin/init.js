#!/usr/bin/env node
const pwd = process.cwd();

let found = true;

if (!process.env.TRV_FRAMEWORK_REGISTERED) {
  process.env.TRV_FRAMEWORK_REGISTERED = '1';
  const isSelf = pwd.includes('/module/boot');
  const isFwk = pwd.includes('/travetto/');
  if (isFwk || isSelf) {
    const TRV_BOOT_ROOT = isSelf ? pwd : `${pwd}/node_modules/@travetto/boot`;
    module.exports = require(`${TRV_BOOT_ROOT}/bin/init`); // Defer to proper location
    found = false;
  }
}

if (found) {
  require('../src/register').RegisterUtil.init();
  module.exports = {
    run: (x, m) => {
      const res = require(x.startsWith('.') ? require('path').resolve(pwd, x) : x);
      return m ? res[m]() : res;
    }
  };
}