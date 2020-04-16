process.env.TRV_CACHE = process.env.TRV_CACHE || '@TMP@/trv-test-@APP@';
require('@travetto/boot/bin/init')
  .libRequire('@travetto/test/bin/lib')
  .watchTests();