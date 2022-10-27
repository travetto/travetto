import { ResourceManager } from '@travetto/resource';
import { RootRegistry } from '@travetto/registry';
import { ConfigManager } from '@travetto/config';

import { DBConfig } from './dbconfig';

export async function main() {
  Object.assign(process.env, Object.fromEntries(
    (await ResourceManager.read('env.properties', 'utf8'))
      .split(/\n/g)
      .map(x => x.split(/\s*=\s*/))));

  await RootRegistry.init();

  await ConfigManager.reset();
  await ConfigManager.init();
  await ConfigManager.install(DBConfig, new DBConfig(), 'database');
  console.log('Config', ConfigManager.toJSON());
}