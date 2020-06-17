#!/usr/bin/env node

const { FsUtil } = require('@travetto/boot/src/fs');

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
 * Compile CLI for usage
 */
function compile() {
  const { AppCache, EnvUtil, TranspileUtil } = require('@travetto/boot');
  const { FrameworkUtil } = require('@travetto/boot/src/framework');

  if (!EnvUtil.isReadonly()) {
    for (const { file, stats } of FrameworkUtil.scan(f => /bin\//.test(f))) {
      if (stats.isFile() && file.endsWith('.ts') && !file.endsWith('.d.ts') && !AppCache.hasEntry(file)) {
        TranspileUtil.transpile(file);
      }
    }
  }
}

/**
 * Start cli
 */
require('@travetto/boot/register');
compile();
require('@travetto/cli/src/execute')
  .ExecutionManager.run(process.argv); // Allow for handing off to local/external cli