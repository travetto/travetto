import '@arcsine/nodesh';
import { PathUtil } from '@travetto/boot';

import { DEP_GROUPS, Packages } from './package/packages';

Packages.yieldPackagesJson()
  .$filter(([folder]) => !folder.includes('travetto.github.io'))
  .$map(([folder, pkg]) => ({ folder, pkg, groups: DEP_GROUPS }))
  .$flatMap(({ folder, pkg, groups }) => [...groups]
    .$flatMap(k => Object.entries(pkg[k] ?? []))
    .$filter(([a]) => !a.startsWith('@travetto'))
    .$collect()
    .$filter(all => all.length > 0)
    .$tap(all => console.log(`Hoisting ${all.length.toString().padStart(2, ' ')} deps for ${folder.replace(PathUtil.cwd, '.')}`))
  )
  .$flatten()
  .$sort(([a], [b]) => a.localeCompare(b))
  .$reduce((acc, [a, b]) => { acc[a] = b; return acc; }, {} as Record<string, unknown>)
  .$forEach(all =>
    'package.json'.$read().$json()
      .$tap(a => a.devDependencies = all)
      .$map(a => Packages.writeOut(PathUtil.cwd, a))
  );
