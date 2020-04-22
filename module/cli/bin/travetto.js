#!/usr/bin/env node

const { FsUtil } = require('@travetto/boot/src/fs-util');
const { EnvUtil } = require('@travetto/boot/src/env');

if (
  !EnvUtil.isSet('trv_dev') && // If not defined
  /\/travetto.*\/(module|sample)\//.test(FsUtil.cwd) // And in local module
) { // If in framework development mode
  const res = require('child_process').spawnSync(process.argv0, process.argv.slice(1), {
    argv0: process.argv0,
    cwd: process.cwd(),
    stdio: [0, 1, 2],
    shell: true,
    env: { // Handle symlinks, and denote we are in framework dev mode
      ...process.env,
      NODE_PRESERVE_SYMLINKS: '1',
      TRV_DEV: '1',
    }
  });
  process.exit(res.status);

}

const fs = require('fs');
const rel = require.resolve('@travetto/cli');
const hasLocal = fs.existsSync(rel);

if (!hasLocal || FsUtil.toUnix(__filename) !== rel) {
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

// @ts-ignore
require('@travetto/boot/bin/init')
  .libRequire('@travetto/cli/src/launch')
  .run(process.argv); // Allow for handing off to local/external cli