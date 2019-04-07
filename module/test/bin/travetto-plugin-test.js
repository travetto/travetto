const cwd = process.cwd();
const TRV_TEST_ROOT = !process.env.TRV_FRAMEWORK_DEV ? '..' :
  (cwd.includes('/module/test') ? cwd : `${cwd}/node_modules/@travetto/test`);

require('@travetto/boot/bin/init')
  .run(`${TRV_TEST_ROOT}/bin/lib`, 'runTestsDirect');