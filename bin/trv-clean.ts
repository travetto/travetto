import '@arcsine/nodesh';

import { FsUtil } from '@travetto/boot';
import { Packages } from './package/packages';

// Clean cache
Packages.yieldPackagesJson()
  .$flatMap(([path]) => path.replace('package.json', '.trv_cache*'))
  .$dir({ allowHidden: true, type: 'dir' })
  .$filter(x => !x.includes('/.'))
  .$parallel(f => FsUtil.unlinkRecursive(f, true))
  .$stdout;