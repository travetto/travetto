import '@arcsine/nodesh';
import * as cp from 'child_process';

import { Util } from './bin/util';
import { Packages } from './bin/packages';

Packages.yieldPublicPackages()
  .$flatMap(x => 'support/service*.ts'.$dir({ base: x._.folder }))
  .$map(f => f.replace(/^.*module\/([^/]+).*$/, (a, m) => `@travetto/${m}`))
  .$collect()
  .$forEach(modules => {
    const proc = cp.spawn('trv', ['command:service', ...process.argv.slice(2)], {
      env: { TRV_MODULES: modules.join(',') },
      stdio: 'inherit',
      cwd: 'module/command',
      shell: false
    });
    Util.enhanceProcess(proc, 'trv command:service');
  });
