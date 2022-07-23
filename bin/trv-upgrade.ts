import '@arcsine/nodesh';

import { DepGroup, DEP_GROUPS, Packages, Pkg } from './package/packages';

Packages.yieldPackages()
  .$map(pkg => ({ pkg, groups: [...DEP_GROUPS] }))
  .$concat(
    Packages.getTopLevelPackage()
      .$map((p): { pkg: Pkg, groups: DepGroup[] } => ({ pkg: p, groups: ['dependencies'] }))
  )
  .$parallel(({ pkg, groups }: { pkg: Pkg, groups: DepGroup[] }) =>
    Packages.upgrade(pkg, groups)
      .$filter(all => all.length > 0)
      .$tap(all => console.log(`${pkg._.folderPadded} updated ${all.length} dependencies - ${all.join(', ') || 'None'}`))
      .$map(() => pkg)
  )
  .$notEmpty()
  .$map(pkg => Packages.writeOut(pkg))
  .then();