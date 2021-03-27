import '@arcsine/nodesh';
import { PathUtil } from '@travetto/boot/src';

import { Packages, Pkg } from './package/packages';

const top = PathUtil.resolveUnix('package.json');

Packages.yieldPackagesJson()
  .$concat([[top, require(top) as Pkg] as const])
  .$parallel(([pth, pkg]) =>
    Packages.upgrade(pth, pkg).$map(all =>
      `.${pth.split(PathUtil.cwd)[1].padEnd(30)} updated ${all.length} dependencies - ${all.join(', ') || 'None'}`
    )
  )
  .$tap(() => Packages.writeAll()) // Write all 
  .$console;