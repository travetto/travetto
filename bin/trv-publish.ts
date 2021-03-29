import * as fs from 'fs';

import '@arcsine/nodesh';

import { ExecUtil } from '@travetto/boot';

import { Modules } from './package/modules';
import { Packages } from './package/packages';

Modules.yieldPackagesJson()
  .$parallel(([path, pkg]) =>
    Packages.showVersion(path, pkg.name, pkg.version)
      .$concat([path])
      .$first()
      .$match(/^[^0-9]/)
  )
  .$notEmpty()
  .$tap((pth) => fs.promises.copyFile('LICENSE', `${pth}/LICENSE`))
  .$parallel(path =>
    ExecUtil.spawn(
      'npm', ['publish', '--dry-run'],
      { cwd: path, stdio: ['pipe', 'pipe', 1] }
    ).result
  )
  .$stdout;