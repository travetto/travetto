// Entry point for the direct execution
process.env.TRV_DEBUG = process.env.TRV_DEBUG || '0';
require('@travetto/boot/register');
require('./lib/list').CliAppListUtil.run(...process.argv.slice(2));