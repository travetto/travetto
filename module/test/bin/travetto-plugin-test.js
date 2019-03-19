const { runTests, prepareEnv } = require(`${process.env.TRV_TEST_ROOT || '..'}/bin/lib`);

prepareEnv({ DEBUGGER: true });

runTests(
  {
    format: process.env.TEST_FORMAT || 'tap',
    mode: process.env.TEST_MODE || 'single',
    concurrency: parseInt(process.env.TEST_CONCURRENCY || '1', 10)
  },
  process.argv.slice(2)
);