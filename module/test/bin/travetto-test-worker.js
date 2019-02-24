// @ts-check

const { TRV_TEST_BASE } = require('./init');
require('@travetto/base/bin/bootstrap');
const { TestChildWorker } = require(`${TRV_TEST_BASE}/src/worker/child`);
new TestChildWorker().activate();