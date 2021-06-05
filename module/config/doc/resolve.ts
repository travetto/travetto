import { ResourceManager } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';

import { DBConfig } from './dbconfig';

export async function main() {
  Object.assign(process.env, Object.fromEntries(
    (await ResourceManager.read('env.properties', 'utf8'))
      .split(/\n/g)
      .map(x => x.split(/\s*=\s*/))));

  await RootRegistry.init();

  const { ConfigManager } = await import('@travetto/config');
  await ConfigManager.reset();
  await ConfigManager.init();
  await ConfigManager.install(DBConfig, new DBConfig(), 'database');
  console.log('Config', ConfigManager.toJSON());
}