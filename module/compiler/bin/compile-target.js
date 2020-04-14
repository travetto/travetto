const { PhaseManager } = require('@travetto/boot/bin/init')
  .libRequire('@travetto/base');
PhaseManager.run().then(() => {
  require('@travetto/compiler').CompilerUtil
    .findAllUncompiledFiles().forEach(require);
});