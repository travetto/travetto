import { BaseCliCommand, CliCommand } from '@travetto/cli';

/**
 * `npx trv echo`
 *
 * Allows for cleaning of the cache dire
 */
@CliCommand()
export class CliEchoCommand implements BaseCliCommand {

  /** Upper case */
  uppercase?: boolean;

  async action(args: string[]) {
    if (this.uppercase) {
      args = args.map(x => x.toUpperCase());
    }
    console.log!(args);
  }
}
