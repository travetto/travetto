import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * Allow for exporting of elasticsearch schemas to stdout
 */
export class EsSchemaPlugin extends BasePlugin {
  name = 'es:schema';

  init(cmd: commander.Command) {
    return cmd
      .option('-a, --app [app]', 'Application to export, (default: .)');
  }

  async action() {
    CliUtil.initAppEnv({ env: 'prod', app: this._cmd.app, plainLog: true });
    const { getSchemas } = await import('./lib');
    console!.log(JSON.stringify(await getSchemas(), null, 2));
  }
}