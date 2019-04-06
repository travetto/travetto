#!/usr/bin/env node

if (!process.env.TRV_READY && process.env.TRV_FRAMEWORK_DEV) {
  process.env.TRV_READY = '1';
  const TRV_BASE_ROOT = (process.cwd().includes('/module/boot') ? process.cwd() :
    `${process.cwd()}/node_modules/@travetto/boot`);
  require(`${TRV_BASE_ROOT}/bin/init`)
} else {
  require(`../src/register`).RegisterUtil.registerLoaders();
}