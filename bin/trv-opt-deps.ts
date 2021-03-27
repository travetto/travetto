import '@arcsine/nodesh';
import { PathUtil } from '@travetto/boot';

import { DEP_GROUPS, Packages } from './package/packages';

Packages.yieldPackagesJson()
  .$map(([path, pkg]) => ({ path, pkg, groups: DEP_GROUPS }))
  .$tap(({ path, groups }) => console.log(`Applying ${groups.join(',')} for ${path.replace(PathUtil.cwd, '')}`))
  .$flatMap(({ pkg, groups }) => [...groups].$map(k => Object.entries(pkg[k] ?? [])))
  .$flatten()
  .$sort(([a], [b]) => a.localeCompare(b))
  .$filter(([a]) => !a.startsWith('@travetto'))
  .$reduce((acc, [a, b]) => { acc[a] = b; return acc; }, {} as Record<string, unknown>)
  .$forEach(all =>
    'package.json'.$read().$json()
      .$tap(a => a.devDependencies = all)
      .$map(a => Packages.writeOut(PathUtil.cwd, a))
  );
