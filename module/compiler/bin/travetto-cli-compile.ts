import * as commander from 'commander';

import { CliUtil, CompletionConfig } from '@travetto/cli/src/util';
import { color } from '@travetto/cli/src/color';
import { CompileUtil } from './lib/util';

// TODO: Document
export function init() {

  return CliUtil.program
    .command('compile')
    .option('-c, --clean', 'Indicates if the cache dir should be cleaned')
    .option('-o, --output <output>', 'Output directory')
    .option('-r, --runtime-dir [runtimeDir]', 'Expected path during runtime')
    .option('-q, --quiet', 'Quiet operation')
    .action(async (cmd: commander.Command) => {

      if (cmd.output) {
        process.env.TRV_CACHE = cmd.output;
      }

      if (cmd.clean) {
        CliUtil.dependOn('clean');
      }

      const { AppCache } = await import(`@travetto/boot`);

      //  Compile
      try {
        await CliUtil.fork(`${__dirname}/compile-target.js`, [], process.env);
      } catch (err) {
        console.error(color`${{ failure: 'Failed' }} to compile to ${{ path: cmd.output ?? AppCache.cacheDir }}`, err);
        process.exit(1);
      }

      if (cmd.runtimeDir) {
        await CompileUtil.rewriteRuntimeDir(cmd.runtimeDir);
      }

      if (!cmd.quiet) {
        console.log(color`${{ success: 'Successfully' }} wrote to ${{ path: cmd.output ?? AppCache.cacheDir }}`);
      }
    });
}

export function complete(c: CompletionConfig) {
  c.all.push('compile');
  c.task.compile = {
    '': ['--clean', '--quiet', '--runtime-dir', '--output']
  };
}