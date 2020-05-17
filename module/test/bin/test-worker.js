/**
 * Entrypoint for a test child worker
 */
require('@travetto/boot/bin/init')
  .libRequire('@travetto/test/bin/lib')
  .worker();