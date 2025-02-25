import util from 'node:util';

import { ConfigurationService } from '@travetto/config';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { hasToJSON } from '@travetto/runtime';

import { DBConfig } from '@travetto/config/doc/dbconfig.ts';

util.inspect.defaultOptions.depth = 5;

export async function main(): Promise<void> {
  await RootRegistry.init();
  const config = await DependencyRegistry.getInstance(ConfigurationService);

  try {
    await config.bindTo(DBConfig, new DBConfig(), 'database');
    console.log('Config', await config.exportActive());
  } catch (err) {
    console.error(hasToJSON(err) ? err.toJSON() : err);
  }
}