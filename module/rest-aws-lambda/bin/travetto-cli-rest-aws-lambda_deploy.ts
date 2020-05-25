import * as commander from 'commander';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * Support for deploying the aws lambda
 */
export class RestAwsLambdaDeployPlugin extends BasePlugin {
  name = 'rest-aws-lambda:deploy';
  init(cmd: commander.Command) {
    return cmd;
  }
  action(config: string) {
    if (!config) {
      this.showHelp();
    } else {
      console!.log('To be implemented...');
    }
  }
}