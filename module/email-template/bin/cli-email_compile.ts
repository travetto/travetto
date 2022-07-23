import { PathUtil } from '@travetto/boot';
import { EnvInit } from '@travetto/base/bin/init';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';

/**
 * CLI Entry point for running the email server
 */
export class EmailCompilePlugin extends BasePlugin {
  name = 'email:compile';

  envInit(): void {
    EnvInit.init({
      append: { TRV_RESOURCES: PathUtil.resolveUnix(__dirname, '..', 'resources') }
    });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  getOptions() {
    return { watch: this.boolOption({ desc: 'Compile in watch mode' }) };
  }

  async action(): Promise<void> {
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');

    const { TemplateUtil } = await import('./lib/util');

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