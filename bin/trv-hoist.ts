import '@arcsine/nodesh';

import { DEP_GROUPS, Packages } from './package/packages';

Packages.getTopLevelPackage()
  .$map(async top => {
    const deps = await Packages.yieldPackages()
      .$filter(p => !p._.folder.includes('travetto.github.io'))
      .$map(pkg => ({ pkg, groups: DEP_GROUPS }))
      .$flatMap(({ pkg, groups }) => [...groups]
        .$flatMap(grp => Object.entries(pkg[grp] ?? []))
        .$filter(([k]) => !k.startsWith('@travetto'))
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
      .$reduce((acc, [a, b]) => { acc[a] = b; return acc; }, {} as Record<string, string>)
      .$value;

    top.devDependencies = deps;
    return Packages.writeOut(top);
  }).then();
