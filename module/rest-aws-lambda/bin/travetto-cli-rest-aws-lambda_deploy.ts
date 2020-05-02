import * as commander from 'commander';
import { CliUtil } from '@travetto/cli/src/util';

// TODO: Document
export function init() {
  return CliUtil.program.command('rest-aws-lambda:deploy')
    .action((config: string, cmd: commander.Command) => {
      if (!config) {
        CliUtil.showHelp(cmd);
      }
      console.log('To be implemented...');
    });
}