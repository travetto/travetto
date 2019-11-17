const { PhaseManager, ScanApp } =
  require('@travetto/boot/bin/init')
    .libRequire('@travetto/base');
PhaseManager.run().then(() => {
  const { AppCache } = require('@travetto/boot')
  ScanApp.getStandardAppFiles()
    .filter(x => !AppCache.hasEntry(x))
    .map(x => require(x));
});
