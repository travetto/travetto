#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

'module/*/support/service*.js'
  .$dir()
  .$map(f => f.replace(/^.*module\/([^/]+).*$/, (a, m) => `@travetto/${m}`))
  .$collect()
  .$forEach(modules => {
    require('child_process').spawnSync('trv', ['command:service', ...$argv], {
      env: {
        ...process.env,
        TRV_MODULES: modules.join(',')
      },
      stdio: [0, 1, 2],
      cwd: 'module/command'
    });
  });
