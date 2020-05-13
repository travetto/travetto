import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { CompletionConfig } from '@travetto/cli/src/types';

/**
 * Allow for exporting of all Models as SQL statements to stdout
 */
export function init() {
  return CliUtil.program
    .command('sql:schema')
    .option('-a, --app [app]', 'Application root to export, (default: .)')
    .option('-c, --clear [clear]', 'Whether or not to clear the database first (default: true)', CliUtil.isBoolean)
    .action(async (cmd: commander.Command) => {
      process.env.TRV_ENV = 'prod';
      process.env.TRV_APP_ROOTS = cmd.app ? `./${cmd.app}` : '';
      process.env.TRV_PROFILE = cmd.app ?? '';
      process.env.TRV_LOG_PLAIN = '1';

      const clear = cmd.clear === undefined ? true : CliUtil.isTrue(cmd.clear);

      const { getSchemas } = await import('./lib');
      console.log((await getSchemas(clear)).join('\n'));
    });
}

export async function complete(c: CompletionConfig) {
  c.all.push('sql:schema');
  c.task.compile = {
    '': ['--clear']
  };
}