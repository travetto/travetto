import * as fs from 'fs';
import '@arcsine/nodesh';

import { FsUtil, PathUtil } from '@travetto/boot';

function optDeps() {
  return [
    ['module/*/package.json', 'optionalPeerDependencies'],
    ['related/vscode-*/package.json', 'devDependencies'],
  ]
    .$flatMap(([p, k]) => p
      .$dir()
      .$flatMap(f => f
        .$read()
        .$json()
        .$tap(() => console.log(`Applying dev/optional dependencies for ${f.replace(PathUtil.cwd, '')}`))
        .$flatMap(x => Object.entries(x[k] ?? []))
      )
    )
    .$sort(([a], [b]) => a.localeCompare(b))
    .$filter(([a]) => !a.startsWith('@travetto'))
    .$reduce((acc, [a, b]) => {
      acc[a] = b;
      return acc;
    }, {} as Record<string, unknown>)
    .$map(all => {
      'package.json'
        .$read()
        .$json()
        .$tap(a => a.devDependencies = all)
        .$map(a => JSON.stringify(a, null, 2))
        .$writeFinal('package.json');
    });
}

function cleanNodeModules() {
  // remove added node modules
  return [
    fs.readdirSync('module')
      .map(x => `module/${x}/node_modules`),
    fs.readdirSync('related')
      .filter(x => /(travetto|vscode)/.test(x))
      .map(x => `related/${x}/node_modules`),
  ]
    .$flatten()
    .$filter(x => !x.includes('/.'))
    .$tap(f => console.log(`Removing ${f}`))
    .$map(f => FsUtil.unlinkRecursive(f, true));
}

optDeps()
  .then(() => $exec('npx', ['lerna', 'bootstrap', '--hoist']))
  .then(() => cleanNodeModules());