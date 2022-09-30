import { CliUtil } from '@travetto/boot';
import { CliCommand, OptionConfig } from '@travetto/cli/src/command';

import { BuildUtil } from '../support/bin/util';

type Options = {
  output: OptionConfig<string>;
  quiet: OptionConfig<boolean>;
};

/**
 * Command line support for building the code with the ability to
 * control the output target.
 */
export class BaseBuildCommand extends CliCommand<Options> {

  name = 'build';

  override async build(): Promise<void> { }

  getOptions(): Options {
    return {
      output: this.option({ desc: 'Output directory', completion: true }),
      quiet: this.boolOption({ desc: 'Quiet operation' })
    };
  }

  async action(): Promise<void> {
    if (this.cmd.output) {
      process.env.TRV_CACHE = this.cmd.output;
    }

    const { AppCache } = await import('@travetto/boot');
    const path = this.cmd.output ?? AppCache.cacheDir;

    try {
      await BuildUtil.build(process.env);

      if (!this.cmd.quiet) {
        console!.log(CliUtil.color`${{ success: 'Successfully' }} wrote to ${{ path }}`);
      }
    } catch (err) {
      console.error(CliUtil.color`${{ failure: 'Failed' }} to compile to ${{ path }}`, err);
      process.exit(1);
    }
  }
}