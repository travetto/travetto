import * as path from 'path';

import { Env } from '@travetto/base';
import { PhaseManager } from '@travetto/boot';
import { CliCommand, CliUtil, OptionConfig } from '@travetto/cli';

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
      append: { TRV_RESOURCES: path.resolve(__source.folder, 'resources').__posix }
    });
  }

  getOptions(): Options {
    return { watch: this.boolOption({ desc: 'Compile in watch mode' }) };
  }

  async action(): Promise<void> {
    await PhaseManager.run('init');

    const { CompileUtil } = await import('../src/util');
    const { TemplateUtil } = await import('./bin/util');

    const all = await CompileUtil.compileAllToDisk();
    console!.log(CliUtil.color`Successfully compiled ${{ param: `${all.length}` }} templates`);

    if (this.cmd.watch) {
      try { require.resolve('@travetto/watch'); }
      catch {
        console.error('@travetto/watch must be installed to watch');
        process.exit(1);
      }
      await TemplateUtil.watchCompile();
      await new Promise(r => process.on('exit', r));
    }
  }
}