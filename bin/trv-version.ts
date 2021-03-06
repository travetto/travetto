import '@arcsine/nodesh';

import { Modules } from './package/modules';
import { Git } from './package/git';
import { Packages, Pkg } from './package/packages';

const [level, prefix] = process.argv.slice(2);

function upgrade(itr: AsyncIterable<Pkg>) {
  return itr
    .$tap(p => console.log(`Upgrading ${p.name} from ${p._.version} to ${p.version}`))
    .$collect()
    .$flatMap((all) =>
      'Continue?'.$prompt().$flatMap(res => res === 'yes' ? all : [])
    )
    .$map(p => Packages.writeOut(p).then(() => p))
    .$collect()
    .$map(all => {
      if (all.length) {
        return Git.publishCommit(all.map(x => x.name).join(','));
      }
    });
}

if (level === 'release') {
  if (!prefix) {
    console.error('You must specify a version to release');
    process.exit(1);
  }
  Git.checkWorkspaceDirty('Cannot update versions with uncomitted changes').then(() =>
    Packages.yieldPublicPackages()
      .$filter(p => p.name.startsWith('@travetto') && !p.private && p.version.includes('-')) // Only take unreleased versions
      .$map(p => Modules.setVersion(p, prefix))
      .$wrap(upgrade)
      .$console
  );
} else {
  Git.checkWorkspaceDirty('Cannot update versions with uncomitted changes').then(() =>
    Git.yieldChangedPackges()
      .$filter(p => p.name.startsWith('@travetto') && !p.private)
      .$map(p => Modules.updateVersion(p, level as 'major', prefix))
      .$wrap(upgrade)
      .$console
  );
}