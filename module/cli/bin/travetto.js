#!/usr/bin/env node

// @ts-check
const fs = require('fs');
const path = require('path');
const { FsUtil } = require('../src/fs-util');

const pkg = '@travetto/cli';
const rel = `${FsUtil.cwd}/node_modules/${pkg}/bin/${path.basename(__filename)}`;

const hasLocal = fs.existsSync(rel);
const isLocal = FsUtil.toUnix(__filename) === rel;

if (__dirname.includes('travetto/module/') && !process.env.NODE_PRESERVE_SYMLINKS) { // If in framework development mode
  const res = require('child_process').spawnSync(process.argv0, process.argv.slice(1), {
    argv0: process.argv0,
    cwd: process.cwd(),
    stdio: [0, 1, 2],
    shell: true,
    env: { // Handle symlinks, and denote we are in framework dev mode
      ...process.env,
      NODE_PRESERVE_SYMLINKS: '1',
      TRV_FRAMEWORK_DEV: process.platform,
    }
  });
  process.exit(res.status);
}

if (!hasLocal || !isLocal) {
  const Module = require('module');
  // @ts-ignore
  const og = Module._load;
  // @ts-ignore
  Module._load = function(req, parent) {
    if (req.startsWith(pkg)) {
      if (!hasLocal) { // Map all $pkg calls to root of global package
        req = FsUtil.resolveUnix(__dirname, `../${FsUtil.toUnix(req).split(`${pkg}/`)[1]}`);
      } else { // Rewrite $pkg to map to local folder, when calling globally
        req = FsUtil.resolveUnix(FsUtil.cwd, `node_modules/${req}`);
      }
    }
    return og.call(Module, req, parent);
  };
}

// @ts-ignore
require(`${pkg}/src/launch`)(process.argv);