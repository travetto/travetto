#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

// Clean cache
[
  '{module,related}/*/node_modules'
    .$dir({ type: 'dir' })
    .$filter(f => /related\/(travetto|vscode)/.test(f)),
  '{module,related}/*/.trv_cache*'
    .$dir({ allowHidden: true, type: 'dir' })
]
  .$flatten()
  .$collect()
  .$map(f => $exec('rm', ['-rf', ...f]))
  .$stdout;