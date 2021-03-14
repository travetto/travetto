#!/usr/bin/env node
import '@arcsine/nodesh';

[
  'module/*/package.json'.$dir()
    .$flatMap(f =>
      f
        .$read()
        .$json()
        .$flatMap(x => Object.entries(x.optionalPeerDependencies ?? []))
    ),
  'related/vscode-*/package.json'.$dir()
    .$flatMap(f =>
      f
        .$read()
        .$json()
        .$flatMap(x => Object.entries(x.devDependencies ?? []))
    )
]
  .$flatten()
  .$sort(([a], [b]) => a.localeCompare(b))
  .$filter(([a]) => !a.startsWith('@travetto'))
  .$reduce((acc, [a, b]) => {
    acc[a] = b;
    return acc;
  }, {} as Record<string, unknown>)
  .$forEach(all => {
    'package.json'
      .$read()
      .$json()
      .$tap(a => a.devDependencies = all)
      .$map(a => JSON.stringify(a, null, 2))
      .$writeFinal('package.json');
  });
