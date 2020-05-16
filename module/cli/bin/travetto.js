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

  // Spawn the cli with needed flags
  ExecUtil.fork(process.argv[1], process.argv.slice(2), {
    stdio: [0, 1, 2],
    shell: true,
    exitOnComplete: true,
    env: { NODE_PRESERVE_SYMLINKS: '1', TRV_DEV: '1', }
  });
  return;
}

/**
 * Handle if cli is install globally
 */
if (!FsUtil.toUnix(__filename).includes(FsUtil.cwd)) { // If the current file is not under the working directory
  const hasLocal = FsUtil.existsSync(`${FsUtil.cwd}/node_modules/@travetto/${FsUtil.toUnix(__filename).split('@travetto/')[1]}`);

  // Map the module loading for targeting the local node_modules
  const Module = require('module');
  const og = Module._load;
  Module._load = function (req, parent) {
    if (req.startsWith('@travetto/cli')) { // Support delegating to installed CLI
      if (!hasLocal) { // Map all $pkg calls to root of global package
        req = FsUtil.resolveUnix(__dirname, `../${FsUtil.toUnix(req).split(`@travetto/cli/`)[1]}`);
      } else { // Rewrite $pkg to map to local folder, when calling globally
        req = FsUtil.resolveUnix(FsUtil.cwd, `node_modules/${req}`);
      }
    }
    return og.call(Module, req, parent);
  };
}

/**
 * Start cli
 */
require('@travetto/boot/bin/init')
  .libRequire('@travetto/cli/src/execute')
  .ExecutionManager.run(process.argv); // Allow for handing off to local/external cli