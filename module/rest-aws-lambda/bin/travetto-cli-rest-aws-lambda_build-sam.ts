import * as path from 'path';
import * as fs from 'fs';
import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { FsUtil } from '@travetto/boot/src/fs';

/**
 * Supports building the SAM for the aws lambda
 */
export function init() {
  return CliUtil.program
    .command('rest-aws-lambda:build-sam')
    .option('-e --env [env]', 'Environment name', 'prod')
    .option('-o --output [output]', 'Output file', 'dist/template.yml')
    .action(async (cmd: commander.Command) => {
      process.env.TRV_ENV = cmd.env;

      cmd.output = FsUtil.resolveUnix(FsUtil.cwd, cmd.output);

      await FsUtil.mkdirp(path.dirname(cmd.output));

      const { PhaseManager } = await import('@travetto/base');
      await PhaseManager.init();

      const { ControllerRegistry } = await import('@travetto/rest');

      await ControllerRegistry.init();
      const controllers = ControllerRegistry.getClasses().map(x => ControllerRegistry.get(x));

      const { template } = await import('./lambda-template-yml');
      const sam = template(controllers, FsUtil.resolveUnix(__dirname, '../resources'));

      fs.writeFileSync(cmd.output, sam, 'utf-8');
    });
}