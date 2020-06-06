#!/usr/bin/env node

const { FsUtil } = require('@travetto/boot/src/fs');
const { ExecUtil } = require('@travetto/boot/src/exec');
const { EnvUtil } = require('@travetto/boot/src/env');

/**
 * Supporting local development
 */
if (
  !EnvUtil.isSet('TRV_DEV') && // If not defined
  /\/travetto.*\/(module|sample)\//.test(FsUtil.cwd) // And in local module
) { // If in framework development mode
  ExecUtil.fork(process.argv[1], process.argv.slice(2), {
    stdio: [0, 1, 2],
    shell: true,
    env: { NODE_PRESERVE_SYMLINKS: 1, TRV_DEV: 1 }
  }).result.catch(err => {
    if (err.meta.code !== 255 && err.meta.code !== 1) {
      console.log(err);
    }
    process.exit(err.meta.code);
  });
  return;
}

/**
 * Handle if cli is install globally
 */
if (!FsUtil.toUnix(__filename).includes(FsUtil.cwd)) { // If the current file is not under the working directory
  const PKG = '@travetto/cli';
  const hasLocal = FsUtil.existsSync(`${FsUtil.cwd}/node_modules/${PKG}`);

  // Map the module loading for targeting the local node_modules
  const Module = require('module');
  const og = Module._load;
  Module._load = function (req, parent) {
    if (req.startsWith(PKG)) { // Support delegating to installed CLI
      req = hasLocal ?
        FsUtil.resolveUnix(FsUtil.cwd, 'node_modules', req) : // Rewrite $PKG to map to local folder
        FsUtil.resolveUnix(__dirname, '..', req.replace(`${PKG}/`, '')); // Map to global package
    }
    return og.call(Module, req, parent);
  };
}

/**
 * Start cli
 */
require('@travetto/boot/register');
require('@travetto/cli/src/execute')
  .ExecutionManager.run(process.argv); // Allow for handing off to local/external cli