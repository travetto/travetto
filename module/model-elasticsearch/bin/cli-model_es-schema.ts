import * as commander from 'commander';

import { EnvInit } from '@travetto/base/bin/init';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * Allow for exporting of elasticsearch schemas to stdout
 */
export class EsSchemaPlugin extends BasePlugin {
  name = 'model:es-schema';

  init(cmd: commander.Command) {
    return cmd;
  }

  async action() {
    EnvInit.init({ env: 'prod' });
    const { getSchemas } = await import('./lib/schema');
    console!.log(JSON.stringify(await getSchemas(), null, 2));
  }
}