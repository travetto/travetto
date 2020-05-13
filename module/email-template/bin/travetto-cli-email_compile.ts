import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { color } from '@travetto/cli/src/color';
import { CompletionConfig } from '@travetto/cli/src/types';

/**
 * CLI Entry point for running the email server
 */
export function init() {
  return CliUtil.program
    .command('email:compile')
    .option('-w, --watch [watch]', 'Compile in watch mode, requires @travetto/watch (default: false)', CliUtil.isBoolean)
    .action(async (cmd: commander.Command) => {
      // process.env.TRV_RESOURCE_ROOTS = `${process.env.TRV_RESOURCE_ROOTS || ''},${__dirname}/lib`;

      const { PhaseManager } = await import('@travetto/base');
      await PhaseManager.bootstrap();

      const { TemplateUtil } = await import('./lib/util');
      const count = (await TemplateUtil.compileAllToDisk()).length;
      console.log(color`Successfully compiled ${{ param: count }} templates`);

      if (CliUtil.isTrue(cmd.watch)) {
        await TemplateUtil.watchCompile();
        await new Promise(r => process.on('exit', r));
      }
    });
}

export function complete(c: CompletionConfig) {
  c.all.push('email:compile');
}