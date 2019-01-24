#!/usr/bin/env node

//@ts-check
const { FsUtil } = require('../src/fs-util');

const fs = require('fs');

const rel = `${FsUtil.cwd}/node_modules/@travetto/cli/bin/travetto.js`;

const hasLocal = fs.existsSync(rel);
const isLocal = FsUtil.toUnix(__filename) === rel;

if (!hasLocal || !isLocal) {
  const Module = require('module');
  // @ts-ignore
  const og = Module._load;
  // @ts-ignore
  Module._load = function (req, parent) {
    if (req.startsWith('@travetto/cli')) {
      if (!hasLocal) { // Map all @travetto/cli calls to root of global package
        req = FsUtil.resolveUnix(__dirname, `../${FsUtil.toUnix(req).split('@travetto/cli/')[1]}`);
      } else { // Rewrite @travetto/cli to map to local folder, when calling globally
        req = FsUtil.resolveUnix(FsUtil.cwd, `node_modules/${req}`);
      }
    }
    return og.call(Module, req, parent);
  };
}

// @ts-ignore
require('@travetto/cli/src')(process.argv);