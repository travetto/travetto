// Entry point for the direct execution
//  all information is passed as env vars
require('@travetto/boot/bin/init')
  .libRequire('@travetto/app/bin/lib/run')
  .RunUtil.run(...process.argv.slice(2));