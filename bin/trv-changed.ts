import '@arcsine/nodesh';

import { Git } from './package/git';

// Clean cache
Git.yieldChangedPackges()
  .$map(p => p._.folderRelative)
  .$stdout;