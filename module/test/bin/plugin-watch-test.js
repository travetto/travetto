/**
 * Triggers the test watcher
 */
process.env.TRV_CACHE = process.env.TRV_CACHE || `${process.cwd()}/.trv_cache_watch`;
require('@travetto/boot/register');
require('./lib').watchTests(...process.argv.slice(2));