import { RootRegistry } from '@travetto/registry';
import { Configuration } from '@travetto/config';
import { DependencyRegistry } from '@travetto/di';

import { DBConfig } from './dbconfig';

export async function main() {
  await RootRegistry.init();
  const config = await DependencyRegistry.getInstance(Configuration);
  await config.bindTo(DBConfig, new DBConfig(), 'database');
  console.log('Config', await config.exportActive());
}