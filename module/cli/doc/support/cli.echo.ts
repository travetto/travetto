import '@travetto/base';
import { CliCommand } from '@travetto/cli';

/**
 * `npx trv echo`
 *
 * Allows for cleaning of the cache dire
 */
export class CliEchoCommand extends CliCommand {
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
