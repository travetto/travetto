#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

// Clean cache
'{module,related}/*/.trv_cache*'
  .$dir({ allowHidden: true, type: 'dir' })
  .$filter(x => !x.includes('node_modules'))
  .$collect()
  .$map(f => $exec('rm', ['-rf', ...f]))
  .$stdout;
