// Invoked by the cli to find the apps in a non-tainted app context
//   this helps when running the app afterwards since not everything
//   will be loaded
process.env.TRV_DEBUG = process.env.TRV_DEBUG || '0';
require('@travetto/boot/bin/init')
  .libRequire('@travetto/app/bin/lib/list')
  .AppListManager.findAll();
