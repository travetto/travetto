const TRV_TEST_ROOT = !process.env.TRV_FRAMEWORK_DEV ? '..' :
  (process.cwd().includes('/module/test') ? process.cwd() :
    `${process.cwd()}/node_modules/@travetto/test`);

const { runTests, prepareEnv } = require(`${TRV_TEST_ROOT}/bin/lib`);

prepareEnv({ DEBUGGER: true });

runTests(
  {
    format: process.env.TEST_FORMAT || 'tap',
    mode: process.env.TEST_MODE || 'single',
    concurrency: parseInt(process.env.TEST_CONCURRENCY || '1', 10)
  },
  process.argv.slice(2)
);