import '@arcsine/nodesh';

import { DEP_GROUPS, Packages } from './package/packages';

Packages.yieldPackages()
  .$filter(p => !p._.folder.includes('travetto.github.io'))
  .$map(pkg => ({ pkg, groups: DEP_GROUPS }))
  .$flatMap(({ pkg, groups }) => [...groups]
    .$flatMap(k => Object.entries(pkg[k] ?? []))
    .$filter(([a]) => !a.startsWith('@travetto'))
    .$collect()
    .$filter(all => all.length > 0)
    .$tap(all => console.log(`Hoisting ${all.length.toString().padStart(2, ' ')} deps for ${pkg._.folderRelative}`))
  )
  .$flatten()
  .$sort(([a], [b]) => a.localeCompare(b))
  .$reduce((acc, [a, b]) => { acc[a] = b; return acc; }, {} as Record<string, string>)
  .$value.then(all =>
    Packages.getTopLevelPackage()
      .$tap(pkg => pkg.devDependencies = all)
      .$map(pkg => Packages.writeOut(pkg))
  );
