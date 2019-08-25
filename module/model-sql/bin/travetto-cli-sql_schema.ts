import * as commander from 'commander';

import { Util, CompletionConfig } from '@travetto/cli/src/util';

export function init() {

  return Util.program
    .command('sql:schema')
    .option('-a, --app [app]', 'Application root to export, (default: .)')
    .option('-c, --clear [clear]', 'Whether or not to clear the database first (default: true)', /^(1|0|yes|no|on|off|auto|true|false)$/i)
    .action(async (cmd: commander.Command) => {
      process.env.ENV = 'prod';
      process.env.APP_ROOTS = cmd.app ? `./${cmd.app}` : '.';
      process.env.PROFILE = cmd.app || '';
      process.env.PLAIN_LOGS = '1';

      const clear = cmd.clear === undefined ? true : /^(1|yes|on|true)/.test(cmd.clear);

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