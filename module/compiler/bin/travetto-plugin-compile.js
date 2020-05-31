/**
 * Forked entrypoint for compiling all code
 */
require('@travetto/boot/bin/init')
  .libRequire('@travetto/base')
  .PhaseManager.init('compile-all');