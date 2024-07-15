import util from 'node:util';

import { ConfigurationService } from '@travetto/config';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { DBConfig } from '@travetto/config/doc/dbconfig';

util.inspect.defaultOptions.depth = 5;

export async function main(): Promise<void> {
  await RootRegistry.init();
  const config = await DependencyRegistry.getInstance(ConfigurationService);

  try {
    await config.bindTo(DBConfig, new DBConfig(), 'database');
    console.log('Config', await config.exportActive());
  } catch (err) {
    if (typeof err === 'object' && !!err && 'toJSON' in err && typeof err.toJSON === 'function') {
      console.error(err.toJSON());
    } else {
      console.error(err);
    }
  }
}