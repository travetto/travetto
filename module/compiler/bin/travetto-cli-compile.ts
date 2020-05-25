import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { color } from '@travetto/cli/src/color';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { CompileUtil } from './lib/util';


/**
 * Command line support for pre-compiling the code with the ability to
 * control the output target.
 */
export class CompilerCompilePlugin extends BasePlugin {

  name = 'compile';

  init(cmd: commander.Command) {
    return cmd
      .option('-c, --clean', 'Indicates if the cache dir should be cleaned')
      .option('-o, --output <output>', 'Output directory')
      .option('-r, --runtime-dir [runtimeDir]', 'Expected path during runtime')
      .option('-q, --quiet', 'Quiet operation');
  }

  async action() {
    if (this._cmd.output) {
      process.env.TRV_CACHE = this._cmd.output;
    }

    if (this._cmd.clean) {
      await CliUtil.dependOn('clean');
    }

    const { AppCache } = await import(`@travetto/boot`);
    CompileUtil.compile(this._cmd.output ?? AppCache.cacheDir);

    if (this._cmd.runtimeDir) {
      await CompileUtil.rewriteRuntimeDir(this._cmd.runtimeDir);
    }

    if (!this._cmd.quiet) {
      console!.log(color`${{ success: 'Successfully' }} wrote to ${{ path: this._cmd.output ?? AppCache.cacheDir }}`);
    }
  }

  complete() {
    return {
      '': ['--clean', '--quiet', '--runtime-dir', '--output']
    };
  }
}