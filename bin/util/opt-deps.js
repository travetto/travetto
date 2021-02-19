#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

'module/*/package.json'
  .$dir()
  .$flatMap(f =>
    f
      .$read()
      .$json()
      .$flatMap(x => Object.entries(x.optionalPeerDependencies ?? []))
  )
  .$sort(([a], [b]) => a.localeCompare(b))
  .$filter(([a]) => !a.startsWith('@travetto'))
  .$reduce((acc, [a, b]) => {
    acc[a] = b;
    return acc;
  }, {})
  .$forEach(all => {
    'package.json'
      .$read()
      .$json()
      .$tap(a => a.devDependencies = all)
      .$map(a => JSON.stringify(a, null, 2))
      .$writeFinal('package.json');
  });
