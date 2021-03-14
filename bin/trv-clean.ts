#!/usr/bin/env node
import * as fs from 'fs';
import '@arcsine/nodesh';

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