/**
 * Entrypoint for a test child worker
 */
require('@travetto/boot/register');
require('./lib').worker();