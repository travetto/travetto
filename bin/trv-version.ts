import '@arcsine/nodesh';

import { Modules } from './package/modules';
import { Git } from './package/git';
import { Packages } from './package/packages';

const [level, prefix] = process.argv.slice(2);

Git.checkWorkspaceDirty('Cannot update versions with uncomitted changes').then(() =>
  Git.yieldChangedPackges()
    .$map(p => Modules.updateVersion(p, level as 'major', prefix))
    .$tap(p => console.log(`Upgrading ${p.name} from ${p._.version} to ${p.version}`))
    .$collect()
    .$flatMap((all) =>
      'Continue?'.$prompt().$flatMap(res => res === 'yes' ? all : [])
    )
    .$map(p => Packages.writeOut(p))
    .$notEmpty()
    .$console
);