import * as path from 'path';
import * as fs from 'fs';
import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { FsUtil } from '@travetto/boot/src/fs';

/**
 * Supports building the SAM for the aws lambda
 */
export class RestAwsLambdaBuildSamPlugin extends BasePlugin {
  name = 'rest-aws-lambda:build-sam';

  init(cmd: commander.Command) {
    return cmd
      .option('-e --env [env]', 'Environment name', 'prod')
      .option('-o --output [output]', 'Output file', 'dist/template.yml');
  }

  async action(config: string) {
    process.env.TRV_ENV = this._cmd.env;

    this._cmd.output = FsUtil.resolveUnix(FsUtil.cwd, this._cmd.output);

    await FsUtil.mkdirp(path.dirname(this._cmd.output));

    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init();

    const { ControllerRegistry } = await import('@travetto/rest');

    await ControllerRegistry.init();
    const controllers = ControllerRegistry.getClasses().map(x => ControllerRegistry.get(x));

    const { template } = await import('./lambda-template-yml');
    const sam = template(controllers, FsUtil.resolveUnix(__dirname, '../resources'));

    fs.writeFileSync(this._cmd.output, sam, 'utf-8');
  }
}