import { PhaseManager } from '@travetto/boot';
import { Configuration } from '@travetto/config';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { DBConfig } from './dbconfig';

export async function main() {
  await PhaseManager.run('init');
  await RootRegistry.init();
  const config = await DependencyRegistry.getInstance(Configuration);

  try {
    await config.bindTo(DBConfig, new DBConfig(), 'database');
    console.log('Config', await config.exportActive());
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.toJSON());
    } else {
      console.error(err);
    }
  }
}