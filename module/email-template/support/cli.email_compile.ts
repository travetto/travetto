import * as path from '@travetto/path';
import { Env } from '@travetto/base';
import { ModuleIndex, PhaseManager } from '@travetto/boot';
import { CliCommand, CliUtil, OptionConfig } from '@travetto/cli';

import { CompileUtil } from '../src/util';
import { TemplateUtil } from './bin/util';

type Options = {
  watch: OptionConfig<boolean>;
};

/**
 * CLI Entry point for running the email server
 */
export class EmailCompileCommand extends CliCommand<Options> {
  name = 'email:compile';

  envInit(): void {
    Env.define({
      append: { TRV_RESOURCES: path.resolve(__source.folder, 'resources') }
    });
  }

  getOptions(): Options {
    return { watch: this.boolOption({ desc: 'Compile in watch mode' }) };
  }

  async action(): Promise<void> {
    await PhaseManager.run('init');

    const all = await CompileUtil.compileAllToDisk();
    console!.log(CliUtil.color`Successfully compiled ${{ param: `${all.length}` }} templates`);

    if (this.cmd.watch) {
      if (ModuleIndex.hasModule('@travetto/watch')) {
        await TemplateUtil.watchCompile();
        await new Promise(r => process.on('exit', r));
      } else {
        console.error('@travetto/watch must be installed to watch');
        process.exit(1);
      }
    }
  }
}