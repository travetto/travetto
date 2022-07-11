import '@arcsine/nodesh';

import { Git } from './package/git';

// Clean cache
Git.yieldChangedPackages()
  .$map(p => p._.folderRelative)
  .$stdout;