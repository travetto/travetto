#!/usr/bin/env node
function init() {
  let root = '..';

  global.TRV_FRAMEWORK_REGISTERED = '1';
  const cwd = process.cwd();
  const isSelf = cwd.includes('/module/boot');
  const isFwk = cwd.includes('/travetto/');
  if (isFwk || isSelf) {
    root = isSelf ? cwd : `${cwd}/node_modules/@travetto/boot`;
  }
  const { RegisterUtil } = require(`${root}/src/register`);
  global.trvInit = RegisterUtil.init();
}

if (!global.TRV_FRAMEWORK_REGISTERED) { // Register once
  init();
}

module.exports = global.trvInit;