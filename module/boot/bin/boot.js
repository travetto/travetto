#!/usr/bin/env node

const TRV_BASE_ROOT = !process.env.TRV_FRAMEWORK_DEV ? '..' :
  (process.cwd().includes('/module/boot') ? process.cwd() :
    `${process.cwd()}/node_modules/@travetto/boot`);

// @ts-ignore
module.exports = require(`${TRV_BASE_ROOT}/bin/lib`).register();