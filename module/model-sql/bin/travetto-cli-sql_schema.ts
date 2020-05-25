import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * Allow for exporting of all Models as SQL statements to stdout
 */
export class SqlSchemaPlugin extends BasePlugin {
  name = 'sql:schema';
  init(cmd: commander.Command) {
    return cmd
      .option('-a, --app [app]', 'Application root to export, (default: .)')
      .option('-c, --clear [clear]', 'Whether or not to clear the database first (default: true)', CliUtil.isBoolean);
  }

  async action() {
    CliUtil.initAppEnv({ env: 'prod', app: this._cmd.app });

    const clear = this._cmd.clear === undefined ? true : CliUtil.isTrue(this._cmd.clear);

    const { getSchemas } = await import('./lib');
    console!.log((await getSchemas(clear)).join('\n'));
  }

  complete() {
    return { '': ['--clear'] };
  }
}