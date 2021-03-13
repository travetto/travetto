import * as commander from 'commander';

import '@travetto/base';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * `npx trv echo`
 *
 * Allows for cleaning of the cache dire
 */
export class CliEchoPlugin extends BasePlugin {
  name = 'echo';

  init(cmd: commander.Command) {
    return cmd.arguments('[args...]')
      .option('-u, --uppercase', 'Upper case', false);
  }

  async action(args: string[]) {
    if (this._cmd.uppercase) {
      args = args.map(x => x.toUpperCase());
    }
    console.log(args);
  }

  complete() {
    return { '': ['--uppercase'] };
  }
}
