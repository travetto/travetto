import '@arcsine/nodesh';

import { Modules } from './package/modules';
import { Git } from './package/git';
import { Packages } from './package/packages';

const [level, prefix] = process.argv.slice(2);

Git.checkWorkspaceDirty('Cannot update versions with uncomitted changes')
  .$concat(Git.findLastRelease())
  .$flatMap(h => Git.findModulesChanged(h))
  .$map(p => Modules.updateVersion(p, level as 'major', prefix))
  .$tap(console.log)
  .$collect()
  .$flatMap(() => 'Continue?'.$prompt())
  .$map(res => {
    if (res === 'yes') {
      return Packages.writeAll().then(() => Git.publishCommit(level))
    } else {
      process.exit(-1);
    }
  })
  .$console;