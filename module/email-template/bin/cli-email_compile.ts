import { color, PathUtil } from '@travetto/boot';
import { EnvInit } from '@travetto/base/support/bin/init';
import { CliCommand, OptionConfig } from '@travetto/cli/src/command';

type Options = {
  watch: OptionConfig<boolean>;
};

/**
 * CLI Entry point for running the email server
 */
export class EmailCompileCommand extends CliCommand<Options> {
  name = 'email:compile';

  envInit(): void {
    EnvInit.init({
      append: { TRV_RESOURCES: PathUtil.resolveUnix(__dirname, '..', 'resources') }
    });
  }

  getOptions(): Options {
    return { watch: this.boolOption({ desc: 'Compile in watch mode' }) };
  }

  async action(): Promise<void> {
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');

    const { TemplateUtil } = await import('../support/bin/util');

    const all = await TemplateUtil.compileAllToDisk();
    console!.log(color`Successfully compiled ${{ param: `${all.length}` }} templates`);

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