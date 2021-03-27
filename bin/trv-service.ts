import '@arcsine/nodesh';
import { ExecUtil } from '@travetto/boot';

'module/*/support/service*.ts'
  .$dir()
  .$map(f => f.replace(/^.*module\/([^/]+).*$/, (a, m) => `@travetto/${m}`))
  .$collect()
  .$forEach(modules => {
    ExecUtil.spawn('trv', ['command:service', ...process.argv.slice(2)], {
      env: { TRV_MODULES: modules.join(',') },
      stdio: 'inherit',
      cwd: 'module/command'
    });
  });
