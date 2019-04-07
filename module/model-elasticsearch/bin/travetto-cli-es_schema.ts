import * as commander from 'commander';

import { Util, CompletionConfig } from '@travetto/cli/src/util';

export function init() {

  return Util.program
    .command('es:schema')
    .option('-a, --app [app]', 'Application to export, (default: .)')
    .action(async (cmd: commander.Command) => {
      process.env.ENV = 'prod';
      process.env.APP_ROOTS = cmd.app ? `./${cmd.app}` : '.';
      process.env.PROFILE = cmd.app || '';

      const { getSchemas } = await import('./lib');
      console.log(JSON.stringify(getSchemas(), null, 2));
    });
}

export async function complete(c: CompletionConfig) {
  c.all.push('es:schema');
}