import { CliCommand } from '@travetto/cli';

@CliCommand()
export class BasicCommand {

  loud?: boolean;

  main() {
    console.log(this.loud ? 'HELLO' : 'Hello');
  }
}