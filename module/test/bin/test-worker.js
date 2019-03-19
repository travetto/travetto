// @ts-check
const TRV_TEST_ROOT = !process.env.TRV_FRAMEWORK_DEV ? '..' :
  (process.cwd().includes('/module/test') ? process.cwd() :
    `${process.cwd()}/node_modules/@travetto/test`);

const { prepareEnv, worker } = require(`${TRV_TEST_ROOT}/bin/lib`);

prepareEnv();
worker();