if (!('DEBUG' in process.env)) {
  process.env.TRACE = process.env.DEBUG = '0';
}
require('@travetto/boot/bin/init')
  .libRequire('@travetto/di/bin/lib/app-list')
  .AppListUtil.discoverAsJson();