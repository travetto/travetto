#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

// Clean cache
[
  'module/*/node_modules'
    .$dir({ type: 'dir' }),
  'related/*/node_modules'
    .$dir({ type: 'dir' })
    .$filter(f => /travetto|vscode/.test(f)),
  '{module,related}/*/.trv_cache*'
    .$dir({ allowHidden: true, type: 'dir' })
]
  .$flatten()
  .$collect()
  .$map(f => $exec('rm', ['-rf', ...f]))
  .$stdout;