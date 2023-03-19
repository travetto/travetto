import { CliCommand } from '@travetto/cli';

@CliCommand()
export class BasicCommand {
  main() {
    console.log('Hello');
  }
}