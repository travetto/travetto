#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

// Clean cache
[
  'module/*/node_modules'
    .$dir({ type: 'dir' }),
  'related/*/node_modules'
    .$dir({ type: 'dir' })
    .$filter(f => /related\/(travetto|vscode)/.test(f)),
  'module/*/.trv_cache*'
    .$dir({ allowHidden: true, type: 'dir' }),
  'related/*/.trv_cache*'
    .$dir({ allowHidden: true, type: 'dir' })
]
  .$flatten()
  .$collect()
  .$map(f => $exec('rm', ['-rf', ...f]))
  .$stdout;