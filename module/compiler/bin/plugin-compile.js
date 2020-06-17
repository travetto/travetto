/**
 * Forked entrypoint for compiling all code
 */
require('@travetto/boot/register');
require('@travetto/base').PhaseManager.init('compile-all');
require('./lib').CompileCliUtil.compileCli();