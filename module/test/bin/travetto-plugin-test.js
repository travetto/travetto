/**
 * Endpoint for running directly from the test plugin
 */
require('@travetto/boot/bin/init')
  .libRequire('@travetto/test/bin/lib')
  .runTestsDirect(...process.argv.slice(2)); // Pass args