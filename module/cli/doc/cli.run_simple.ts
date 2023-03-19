import { CliCommand } from '@travetto/cli';

/**
 * Simple Run Target
 */
@CliCommand({ runTarget: true })
export class RunCommand {

  main(name: string) {
    console.log(name);
  }
}