require('@travetto/boot/bin/init')
  .libRequire('@travetto/base')
  .PhaseManager.init();
require('./simple.child');