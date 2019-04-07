import * as path from 'path';
import * as fs from 'fs';
import * as commander from 'commander';

import { Util } from '@travetto/cli/src/util';
import { FsUtil } from '@travetto/boot';

export function init() {
  return Util.program
    .command('rest-aws-lambda:build-sam')
    .option('-e --env [env]', 'Environment name', 'prod')
    .option('-o --output [output]', 'Output file', 'dist/template.yml')
    .action(async (cmd: commander.Command) => {
      process.env.ENV = cmd.env;

      cmd.output = FsUtil.resolveUnix(FsUtil.cwd, cmd.output);

      FsUtil.mkdirp(path.dirname(cmd.output));

      const { PhaseManager } = await import('@travetto/base');
      await PhaseManager.init('bootstrap').run();

      const { ControllerRegistry } = await import('@travetto/rest');

      await ControllerRegistry.init();
      const controllers = ControllerRegistry.getClasses().map(x => ControllerRegistry.get(x));

      const { template } = require(FsUtil.resolveUnix(__dirname, '../resources/template.yml.js'));
      const sam = template(controllers, FsUtil.resolveUnix(__dirname, '../resources'));

      fs.writeFileSync(cmd.output, sam, 'utf-8');
    });
}