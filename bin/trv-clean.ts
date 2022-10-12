import '@arcsine/nodesh';
import * as fs from 'fs/promises';

import { Packages } from './package/packages';

// Clean cache
Packages.yieldPackages()
  .$flatMap(pkg => '.trv_cache*'.$dir({ allowHidden: true, type: 'dir', base: pkg._.folder }))
  .$parallel(f => fs.rm(f, { recursive: true, force: true }).then(() => f))
  .$stdout;