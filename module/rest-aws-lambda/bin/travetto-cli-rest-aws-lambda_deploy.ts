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
  async action(config: string) {
    if (!config) {
      await this.showHelp();
    } else {
      console!.log('To be implemented...');
    }
  }
}