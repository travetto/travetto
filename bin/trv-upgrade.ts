import '@arcsine/nodesh';
import { PathUtil } from '@travetto/boot/src';

import { DEP_GROUPS, Packages, Pkg } from './package/packages';

const top = PathUtil.resolveUnix('package.json');
const topPkg = require(top) as Pkg;

const upgrade = (pth: string, pkg: Pkg, groups: (typeof DEP_GROUPS[number])[], key = pth.split(PathUtil.cwd)[1].padEnd(30)) =>
  Packages.upgrade(pth, pkg, groups)
    .$filter(all => all.length > 0)
    .$tap(all => console.log(`.${key} updated ${all.length} dependencies - ${all.join(', ') || 'None'}`))

Packages.yieldPackagesJson()
  .$map(([pth, pkg]) => ({ pth, pkg, groups: [...DEP_GROUPS] }))
  .$parallel(({ pth, pkg, groups }) => upgrade(pth, pkg, groups))
  .$tap(() => Packages.writeAll()) // Write all 
  .$concat(upgrade(top, topPkg, ['dependencies']))
  .$forEach(() => Packages.writeOut(top, topPkg));