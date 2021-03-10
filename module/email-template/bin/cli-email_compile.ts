import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';

/**
 * CLI Entry point for running the email server
 */
export class EmailCompilePlugin extends BasePlugin {
  name = 'email:compile';

  init(cmd: commander.Command) {
    return cmd.option('-w, --watch [watch]', 'Compile in watch mode, requires @travetto/watch (default: false)', CliUtil.isBoolean);
  }

  async action() {
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');

    const { TemplateUtil } = await import('./lib/util');

    const all = await TemplateUtil.compileAllToDisk();
    console!.log(color`Successfully compiled ${{ param: `${all.length}` }} templates`);

    if (CliUtil.isTrue(this._cmd.watch)) {
      await TemplateUtil.watchCompile();
      await new Promise(r => process.on('exit', r));
    }
  }
}