// Invoked by the cli to find the apps in a non-tainted app context
//   this helps when running the app afterwards since not everything
//   will be loaded
process.env.DEBUG = process.env.DEBUG || '0';
require('@travetto/boot/bin/init')
  .libRequire('@travetto/app/bin/lib/list')
  .AppListManager.findAll()
  .then(x => console.log(JSON.stringify(x)));