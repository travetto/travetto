import * as fs from 'fs/promises';
import * as cp from 'child_process';

import '@arcsine/nodesh';

import { Packages } from './package/packages';
import { Util } from './package/util';

Packages.yieldPublicPackages()
  .$filter(p => p.name.startsWith('@travetto'))
  .$map(async pkg => [await Packages.findPublishedPackageVersion(pkg), pkg] as const)
  .$filter(([v,]) => !v)
  .$map(([, pkg]) => pkg)
  .$tap(pkg => fs.copyFile('LICENSE', `${pkg!._.folder}/LICENSE`))
  .$map(pkg => {
    const tag = pkg?.version?.replace(/^.*-(rc|latest|alpha|beta|next)[.]\d+/, (a, b) => b) || 'latest';
    const args = [
      'publish',
      '--tag', tag,
      '--access', 'public'
    ];
    if (!/^[~^]/.test(tag) && !/-(rc|latest|alpha|beta|next)[.]\d+$/.test(pkg.version)) {
      args.push('--tag', 'latest');
    }
    const proc = cp.spawn('npm', args, { shell: false, cwd: pkg!._.folder, stdio: [0, 1, 2] });
    return Util.enhanceProcess(proc, 'npm publish');
  })
  .$stdout;