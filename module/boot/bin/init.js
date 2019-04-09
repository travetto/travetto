#!/usr/bin/env node
function init() {
  let root = '..';

  const cwd = process.cwd();
  const isSelf = cwd.includes('/module/boot');
  const isFwk = cwd.includes('/travetto/');
  if (isFwk || isSelf) {
    root = isSelf ? cwd : `${cwd}/node_modules/@travetto/boot`;
  }
  const { RegisterUtil } = require(`${root}/src/register`);
  RegisterUtil.init();
}

if (!global.trvInit) { // Register once
  init();
}

module.exports = global.trvInit;