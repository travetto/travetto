import { CliUtil, CliCommand, OptionConfig } from '@travetto/cli';

import { BuildUtil } from './bin/util';

type Options = {
  compiler: OptionConfig<string>;
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
      compiler: this.option({ desc: 'Compiler directory', def: '.trv_compiler' }),
      output: this.option({ desc: 'Output directory', completion: true, def: '.trv_out' }),
      quiet: this.boolOption({ desc: 'Quiet operation' })
    };
  }

  async action(): Promise<void> {
    const path = this.cmd.output;
    try {
      await BuildUtil.build(path, this.cmd.compiler);

      if (!this.cmd.quiet) {
        console!.log(CliUtil.color`${{ success: 'Successfully' }} wrote to ${{ path }}`);
      }
    } catch (err) {
      console.error(CliUtil.color`${{ failure: 'Failed' }} to compile to ${{ path }}`, err);
      process.exit(1);
    }
  }
}