// Entry point for the direct execution
//  all information is passed as env vars
require('@travetto/boot/register');
require('./lib/run').RunUtil.run(...process.argv.slice(2));
