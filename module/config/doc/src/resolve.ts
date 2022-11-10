import { CommonFileResourceProvider } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';
import { ConfigManager } from '@travetto/config';

import { DBConfig } from './dbconfig';

export async function main() {
  const resource = new CommonFileResourceProvider();

  Object.assign(process.env, Object.fromEntries(
    (await resource.read('/env.properties'))
      .split(/\n/g)
      .map(x => x.split(/\s*=\s*/))));

  await RootRegistry.init();

  await ConfigManager.init();
  await ConfigManager.install(DBConfig, new DBConfig(), 'database');
  console.log('Config', ConfigManager.toJSON());
}