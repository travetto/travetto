// Entry point for the VSCode plugin to execute
//  all information is passed as env vars
require('@travetto/boot/bin/init')
  .libRequire('@travetto/app/bin/lib/list')
  .AppListManager.getList()
  .then(x => console.log(JSON.stringify(x)));