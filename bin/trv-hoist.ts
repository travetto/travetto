import '@arcsine/nodesh';
import * as path from 'path';

import { DEP_GROUPS, Packages } from './package/packages';

Packages.getTopLevelPackage()
  .$map(async top => {
    const deps = await Packages.yieldPackages()
      .$filter(p => !p._.folder.includes('travetto.github.io'))
      .$map(pkg => ({ pkg, groups: DEP_GROUPS }))
      .$flatMap(({ pkg, groups }) => [...groups]
        .$flatMap(grp => Object.entries(pkg[grp] ?? []))
        .$map(([k, v]) => [k, v.startsWith('file:') ?
          `file:${path.resolve(pkg._.folder, v.split('file:')[1]).replace(process.cwd(), '.').replaceAll('\\', '/')}` : v
        ])
        .$collect()
        .$tap(all => {
          const hoisted = all.filter(([k, v]) => (top.devDependencies ?? {})[k] !== v);
          if (hoisted.length > 0) {
            console.log(`Hoisting ${hoisted.length.toString().padStart(2, ' ')} deps for ${pkg._.folderRelative}`);
          }
        })
      )
      .$flatten()
      .$sort(([a], [b]) => a.localeCompare(b))
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .$reduce((acc: Record<string, string>, [a, b]) => { acc[a] = b as string; return acc; }, {})
      .$value;

    top.devDependencies = deps;
    return Packages.writeOut(top);
  }).then();
