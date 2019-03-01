function prepareEnv(extra = {}) {
  Object.assign(process.env, {
    QUIET_INIT: '1',
    DEBUG: process.env.DEBUG || '0',
    PROD: '0',
    TRV_CACHE_DIR: 'TRV_CACHE_DIR' in process.env ? process.env.TRV_CACHE_DIR : '-',
    APP_ROOTS: '0',
    WATCH: '0',
    PROFILE: 'test',
    RESOURCE_ROOTS: 'test',
    ...extra
  });
}

async function runTests(opts, args) {
  try {

    await require('@travetto/base/bin/bootstrap').run();

    // Pre compile all
    require('@travetto/compiler').Compiler.compileAll();

    const { Runner } = require('../src/runner/runner');
    const { TestUtil } = require('../src/runner/util');

    TestUtil.registerCleanup('runner');

    const res = await new Runner({
      format: opts.format,
      consumer: opts.consumer,
      mode: opts.mode,
      concurrency: opts.concurrency,
      args
    }).run();
    process.exit(res ? 0 : 1);
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  }
}

function worker() {
  require('@travetto/base/bin/bootstrap');
  const { TestChildWorker } = require('../src/worker/child');
  return new TestChildWorker().activate();
}

module.exports = {
  runTests,
  prepareEnv,
  worker
};