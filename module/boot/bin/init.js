#!/usr/bin/env node
const pwd = process.cwd();

function build() {

  let root = '..';

  if (!process.env.TRV_FRAMEWORK_REGISTERED) {
    process.env.TRV_FRAMEWORK_REGISTERED = '1';
    const isSelf = pwd.includes('/module/boot');
    const isFwk = pwd.includes('/travetto/');
    if (isFwk || isSelf) {
      root = isSelf ? pwd : `${pwd}/node_modules/@travetto/boot`;
    }
  }

  require(`${root}/src/register`).RegisterUtil.init();
}

module.exports = build();