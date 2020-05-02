import * as commander from 'commander';

import { CliUtil, CompletionConfig } from '@travetto/cli/src/util';

/**
 * Allow for exporting of all Models as SQL statements to stdout
 */
export function init() {
  return CliUtil.program
    .command('sql:schema')
    .option('-a, --app [app]', 'Application root to export, (default: .)')
    .option('-c, --clear [clear]', 'Whether or not to clear the database first (default: true)', CliUtil.BOOLEAN_RE)
    .action(async (cmd: commander.Command) => {
      process.env.ENV = 'prod';
      process.env.APP_ROOTS = cmd.app ? `./${cmd.app}` : '';
      process.env.PROFILE = cmd.app ?? '';
      process.env.PLAIN_CONSOLE = '1';

      const clear = cmd.clear === undefined ? true : CliUtil.TRUE_RE.test(cmd.clear);

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