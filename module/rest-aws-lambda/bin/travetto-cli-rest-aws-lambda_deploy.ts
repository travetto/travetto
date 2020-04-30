import * as commander from 'commander';
import { Util } from '@travetto/cli/src/util';

// TODO: Document
export function init() {
  return Util.program.command('rest-aws-lambda:deploy')
    .action((config: string, cmd: commander.Command) => {
      if (!config) {
        Util.showHelp(cmd);
      }
      console.log('To be implemented...');
    });
}