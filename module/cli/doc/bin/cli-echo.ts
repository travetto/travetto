import '@travetto/base';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * `npx trv echo`
 *
 * Allows for cleaning of the cache dire
 */
export class CliEchoPlugin extends BasePlugin {
  name = 'echo';

  getOptions() {
    return { uppercase: this.boolOption({ desc: 'Upper case', def: false }) };
  }

  getArgs() {
    return '[args...]';
  }

  async action(args: string[]) {
    if (this.cmd.uppercase) {
      args = args.map(x => x.toUpperCase());
    }
    console.log(args);
  }
}
