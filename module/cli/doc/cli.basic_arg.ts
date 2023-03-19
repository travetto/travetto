import { CliCommand } from '@travetto/cli';
import { Max, Min } from '@travetto/schema';

@CliCommand()
export class BasicCommand {

  main(@Min(1) @Max(10) volume: number = 1) {
    console.log(volume > 7 ? 'HELLO' : 'Hello');
  }
}