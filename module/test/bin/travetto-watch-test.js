// TODO: Document
process.env.TRV_CACHE = process.env.TRV_CACHE || `${process.cwd()}/.trv-cache_${Date.now()}`;
require('@travetto/boot/bin/init')
  .libRequire('@travetto/test/bin/lib')
  .watchTests();