import { type CliCommandShape, CliCommand } from '@travetto/cli';

/**
 * Allows for cleaning of the cache dire
 */
@CliCommand()
export class CliEchoCommand implements CliCommandShape {

  /** Upper case */
  uppercase?: boolean;

  async main(args: string[]): Promise<void> {
    if (this.uppercase) {
      args = args.map(arg => arg.toUpperCase());
    }
    console.log!(args);
  }
}
