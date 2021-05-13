import '@arcsine/nodesh';

import { FsUtil } from '@travetto/boot';

import { Packages } from './package/packages';

// Clean cache
Packages.yieldPackages()
  .$flatMap(pkg => '.trv_cache*'.$dir({ allowHidden: true, type: 'dir', base: pkg._.folder }))
  .$parallel(f => FsUtil.unlinkRecursive(f).then(() => f))
  .$stdout;