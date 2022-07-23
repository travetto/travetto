import { ConfigManager } from '@travetto/config';
import { RootRegistry } from '@travetto/registry';

import { DBConfig } from './dbconfig';

export async function main() {
  await ConfigManager.init();
  await RootRegistry.init();
  try {
    await ConfigManager.install(DBConfig, new DBConfig(), 'database');
    console.log('Config', ConfigManager.toJSON());
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.toJSON());
    } else {
      console.error(err);
    }
  }
}