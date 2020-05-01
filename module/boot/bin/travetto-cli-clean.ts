import * as commander from 'commander';
import { Util, CompletionConfig } from '@travetto/cli/src/util';
import { color } from '@travetto/cli/src/color';

/**
 * `npx trv clean`
 *
 * Allows for cleaning of the cache dire
 */
export function init() {
  return Util.program.command('clean')
    .option('-q, --quiet', 'Quiet operation')
    .action(async (cmd: commander.Command) => {
      const { AppCache } = await import('../src/app-cache');
      try {
        AppCache.clear(true);

        if (!cmd.quiet) {
          console.log(color`${{ success: 'Successfully' }} deleted temp dir ${{ path: AppCache.cacheDir }}`);
        }
      } catch (e) {
        console.error(color`${{ failure: 'Failed' }} to delete temp dir ${{ path: AppCache.cacheDir }}`);
      }
    });
}

export function complete(c: CompletionConfig) {
  c.all.push('clean');
  c.task.clean = {
    '': ['--quiet']
  };
}
