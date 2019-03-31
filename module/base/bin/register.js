#!/usr/bin/env node

const TRV_BASE_ROOT = !process.env.TRV_FRAMEWORK_DEV ? '..' :
  (process.cwd().includes('/module/base') ? process.cwd() :
    `${process.cwd()}/node_modules/@travetto/base`);

// @ts-ignore
module.exports = require(`${TRV_BASE_ROOT}/bin/lib`).register();