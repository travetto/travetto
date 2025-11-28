import util from 'node:util';

import { Registry } from '@travetto/registry';
import { ConfigurationService } from '@travetto/config';
import { DependencyRegistryIndex } from '@travetto/di';
import { DBConfig } from '@travetto/config/doc/dbconfig.ts';

util.inspect.defaultOptions.depth = 5;

export async function main(): Promise<void> {
  await Registry.init();
  process.env.DATABASE_PORT = '2000';
  const config = await DependencyRegistryIndex.getInstance(ConfigurationService);
  await config.bindTo(DBConfig, new DBConfig(), 'database');
  console.log('Config', await config.exportActive());
}