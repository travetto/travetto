import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { color } from '@travetto/cli/src/color';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * CLI Entry point for running the email server
 */
export class EmailCompilePlugin extends BasePlugin {
  name = 'email:compile';

  init(cmd: commander.Command) {
    return cmd.option('-w, --watch [watch]', 'Compile in watch mode, requires @travetto/watch (default: false)', CliUtil.isBoolean);

  }
  async action() {
    const { TemplateUtil } = await import('./lib/util');
    await TemplateUtil.initApp();

    const count = (await TemplateUtil.compileAllToDisk()).length;
    console!.log(color`Successfully compiled ${{ param: count }} templates`);

    if (CliUtil.isTrue(this._cmd.watch)) {
      await TemplateUtil.watchCompile();
      await new Promise(r => process.on('exit', r));
    }
  }
}