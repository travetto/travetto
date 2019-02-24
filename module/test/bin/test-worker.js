// @ts-check
const { prepareEnv, worker } = require(`${process.env.TRV_TEST_BASE || '..'}/bin/lib`);

prepareEnv();
worker();