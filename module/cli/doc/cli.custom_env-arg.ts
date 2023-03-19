import { CliCommand } from '@travetto/cli';
import { Max, Min } from '@travetto/schema';

/**
 * Custom Argument Command
 */
@CliCommand()
export class CustomCommand {

  /**
   * The message to send back to the user
   * @alias env.MESSAGE
   */
  text: string = 'hello';

  main(@Min(1) @Max(10) volume: number = 1) {
    console.log(volume > 7 ? this.text.toUpperCase() : this.text);
  }
}