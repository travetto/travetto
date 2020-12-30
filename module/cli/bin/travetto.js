#!/usr/bin/env node

/**
 * Handle if cli is install globally
 */
if (!process.env.TRV_DEV) {
  const { FsUtil } = require('@travetto/boot/src/fs');
  if (!FsUtil.toUnix(__filename).includes(FsUtil.cwd)) { // If the current file is not under the working directory
    console.error('The @travetto/cli is not intended to be installed globally.  Please install it within your local project');
    console.error('');
    console.error('npm i @travetto/cli');
    console.error('');
    process.exit(1);
  }
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
require('@travetto/cli/src/execute').ExecutionManager.run(process.argv); // Allow for handing off to local/external cli