import '@arcsine/nodesh';

import { Modules } from './package/modules';
import { Git } from './package/git';
import { Packages } from './package/packages';

Git.findLastRelease()
  .$flatMap(h => Git.findModulesChanged(h))
  .$map(p => Modules.updateVersion(p, 'prerelease'))
  .$tap(console.log)
  .$collect()
  .$flatMap(() => 'Continue?'.$prompt())
  .$map(res => {
    if (res === 'yes') {
      return Packages.writeAll().then(() => Git.publishCommit('prerelease'))
    } else {
      process.exit(-1);
    }
  })
  .$console;