import * as commander from 'commander';

import { Util, CompletionConfig } from '@travetto/cli/src/util';

export function init() {

  return Util.program
    .command('sql:schema')
    .option('-a, --app [app]', 'Application root to export, (default: .)')
    .action(async (cmd: commander.Command) => {
      process.env.ENV = 'prod';
      process.env.APP_ROOTS = cmd.app ? `./${cmd.app}` : '.';
      process.env.PROFILE = cmd.app || '';
      process.env.PLAIN_LOGS = '1';

      const { getSchemas } = await import('./lib');
      console.log((await getSchemas()).join('\n'));
    });
}

export async function complete(c: CompletionConfig) {
  c.all.push('sql:schema');
}