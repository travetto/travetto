#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { FsUtil } from '@travetto/boot';

const pkg = '@travetto/cli';
const rel = `${FsUtil.cwd}/node_modules/${pkg}/bin/${path.basename(__filename)}`;

const hasLocal = fs.existsSync(rel);
const isLocal = FsUtil.toUnix(__filename) === rel;

const frameworkYetDeclared = FsUtil.toUnix(__dirname).includes('module/cli') && !process.env.TRV_FRAMEWORK_DEV;
const cliExternal = !hasLocal || !isLocal;

if (frameworkYetDeclared) { // If in framework development mode
  const res = child_process.spawnSync(process.argv0, process.argv.slice(1), {
    argv0: process.argv0,
    cwd: process.cwd(),
    stdio: [0, 1, 2],
    shell: true,
    env: { // Handle symlinks, and denote we are in framework dev mode
      ...process.env,
      NO_JS_YAML: '1',
      NODE_PRESERVE_SYMLINKS: '1',
      TRV_FRAMEWORK_DEV: process.platform,
    }
  });
  process.exit(res.status);
} else if (cliExternal) {
  const Module = require('module');
  // @ts-ignore
  const og = Module._load;
  // @ts-ignore
  Module._load = function (req: string, parent: NodeModule) {
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
require(`${pkg}/src/launch`)(process.argv); // Allow for handing off to local/external cli