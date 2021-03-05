#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

const fs = require('fs');

// Clean cache
[
  '{module,related}/*/.trv_cache*'
    .$dir({ allowHidden: true, type: 'dir' }),
  fs.readdirSync('module')
    .map(x => `module/${x}/node_modules`),
  fs.readdirSync('related')
    .filter(x => /(travetto|vscode)/.test(x))
    .map(x => `related/${x}/node_modules`),
]
  .$flatten()
  .$filter(x => !x.includes('/.'))
  .$collect()
  .$map(f => $exec('rm', ['-rf', ...f]))
  .$stdout;