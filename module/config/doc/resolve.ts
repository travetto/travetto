import util from 'util';

import { RootRegistry } from '@travetto/registry';
import { ConfigurationService } from '@travetto/config';
import { DependencyRegistry } from '@travetto/di';
import { DBConfig } from '@travetto/config/doc/dbconfig';

util.inspect.defaultOptions.depth = 5;

export async function main(): Promise<void> {
  await RootRegistry.init();
  process.env.DATABASE_PORT = '2000';
  const config = await DependencyRegistry.getInstance(ConfigurationService);
  await config.bindTo(DBConfig, new DBConfig(), 'database');
  console.log('Config', await config.exportActive());
}