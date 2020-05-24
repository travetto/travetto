/**
 * Triggers the test watcher
 */
process.env.TRV_TEST_COMPILE = '1';
process.env.TRV_CACHE = process.env.TRV_CACHE || `${process.cwd()}/.trv_cache_watch`;
require('@travetto/boot/bin/init')
  .libRequire('@travetto/test/bin/lib')
  .watchTests(...process.argv.slice(2));