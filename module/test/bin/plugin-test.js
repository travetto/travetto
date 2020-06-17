/**
 * Endpoint for running directly from the test plugin
 */
require('@travetto/boot/register');
require('./lib').runTestsDirect(...process.argv.slice(2)); // Pass args