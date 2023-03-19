import { CliCommand } from '@travetto/cli';
import { Max, Min } from '@travetto/schema';

@CliCommand()
export class BasicCommand {

  reverse?: boolean;

  main(@Min(1) @Max(10) volumes: number[]) {
    console.log(volumes.sort((a, b) => (a - b) * (this.reverse ? -1 : 1)).join(' '));
  }
}