import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { CompletionConfig } from '@travetto/cli/src/types';

/**
 * Allow for exporting of elasticsearch schemas to stdout
 */
export function init() {
  return CliUtil.program
    .command('es:schema')
    .option('-a, --app [app]', 'Application to export, (default: .)')
    .action(async (cmd: commander.Command) => {
      CliUtil.initAppEnv({ env: 'prod', app: cmd.app, plainLog: true });
      const { getSchemas } = await import('./lib');
      console!.log(JSON.stringify(await getSchemas(), null, 2));
    });
}

export async function complete(c: CompletionConfig) {
  c.all.push('es:schema');
}