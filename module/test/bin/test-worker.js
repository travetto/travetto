// @ts-check
const { prepareEnv, worker } = require(`${process.env.TRV_TEST_ROOT || '..'}/bin/lib`);

prepareEnv();
worker();