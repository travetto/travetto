import * as fs from 'fs';

import '@arcsine/nodesh';

import { ExecUtil } from '@travetto/boot';

import { Packages } from './package/packages';

Packages.yieldPublicPackages()
  .$parallel(pkg => Packages.showPackageVersion(pkg).$value
    .then(val => !val ? pkg : undefined))
  .$notEmpty()
  .$tap(pkg => fs.promises.copyFile('LICENSE', `${pkg!._.folder}/LICENSE`))
  .$parallel(pkg =>
    ExecUtil.spawn('npm', ['publish', '--dry-run'],
      { cwd: pkg!._.folder, stdio: ['pipe', 'pipe', 1] }
    ).result
  )
  .$stdout;