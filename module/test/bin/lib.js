function prepareEnv(extra = {}) {
  Object.assign(process.env, {
    QUIET_INIT: '1',
    DEBUG: process.env.DEBUG || '0',
    PROD: '0',
    LOG_TIME: '0',
    TRV_CACHE_DIR: 'TRV_CACHE_DIR' in process.env ? process.env.TRV_CACHE_DIR : '-',
    APP_ROOTS: '0',
    WATCH: '0',
    PROFILE: 'test',
    RESOURCE_ROOTS: 'test',
    ...extra
  });
}

async function runTests(opts, args) {
  require('@travetto/base/bin/register');
  const { StandardWorker } = require('../src/worker/standard');
  return StandardWorker.run(opts, args);
}

async function worker() {
  require('@travetto/base/bin/register');
  const { TestChildWorker } = require('../src/worker/child');
  return new TestChildWorker().activate();
}

module.exports = {
  runTests,
  prepareEnv,
  worker
};