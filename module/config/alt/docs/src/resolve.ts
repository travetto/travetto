import * as fs from 'fs';
import { FsUtil } from '@travetto/boot/src';


(async function run() {
  fs.readFileSync(FsUtil.resolveUnix(__dirname, '..', 'resources', 'env.properties'), 'utf8')
    .split(/\n/g)
    .map(x => x.split(/\s*=\s*/))
    .reduce((a, [k, v]) => {
      a[k] = v;
      return a;
    }, process.env);

  process.env.TRV_RESOURCE_ROOTS = `alt/docs`;

  const { ConfigManager } = await import('../../../src/manager');
  ConfigManager.init();
  console.log('Config', ConfigManager.get() as Record<string, string>);
}());