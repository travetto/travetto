import '@arcsine/nodesh';

import { FsUtil } from '@travetto/boot/src';

import { Packages } from './package/packages';

// Clean cache
Packages.yieldPackagesJson()
  .$flatMap(([path]) => '.trv_cache*'.$dir({ allowHidden: true, type: 'dir', base: path }))
  .$filter(x => x.includes('/.trv_cache'))
  .$parallel(f => FsUtil.unlinkRecursive(f, true).then(x => f))
  .$stdout;