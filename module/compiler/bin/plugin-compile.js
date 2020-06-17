/**
 * Forked entrypoint for compiling all code
 */
require('@travetto/boot/register');
require('./lib').CompileCliUtil.compileAll();