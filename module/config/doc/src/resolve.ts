import { Resources } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';
import { ConfigManager } from '@travetto/config';

import { DBConfig } from './dbconfig';

export async function main() {
  Object.assign(process.env, Object.fromEntries(
    (await Resources.read('file:/env.properties'))
      .split(/\n/g)
      .map(x => x.split(/\s*=\s*/))));

  await RootRegistry.init();

  await ConfigManager.init();
  await ConfigManager.install(DBConfig, new DBConfig(), 'database');
  console.log('Config', ConfigManager.toJSON());
}