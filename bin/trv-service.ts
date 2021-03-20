import { spawnSync } from 'child_process';
import '@arcsine/nodesh';

'module/*/support/service*.ts'
  .$dir()
  .$map(f => f.replace(/^.*module\/([^/]+).*$/, (a, m) => `@travetto/${m}`))
  .$collect()
  .$forEach(modules => {
    spawnSync('trv', ['command:service', ...process.argv.slice(2)], {
      env: {
        ...process.env,
        TRV_MODULES: modules.join(',')
      },
      stdio: [0, 1, 2],
      cwd: 'module/command'
    });
  });
