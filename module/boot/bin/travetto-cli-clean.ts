import * as commander from 'commander';
import { Util, CompletionConfig } from '@travetto/cli/src/util';

export function init() {
  return Util.program.command('clean')
    .option('-q, --quiet', 'Quiet operation')
    .action(async (cmd: commander.Command) => {
      const { AppCache } = await import('../src/app-cache');
      try {
        AppCache.clear(true);

        if (!cmd.quiet) {
          console.log(`${Util.colorize.success('Successfully')} deleted temp dir ${Util.colorize.path(AppCache.cacheDir)}`);
        }
      } catch (e) {
        console.error(`${Util.colorize.failure('Failed')} to delete temp dir ${Util.colorize.path(AppCache.cacheDir)}`);
      }
    });
}

export function complete(c: CompletionConfig) {
  c.all.push('clean');
  c.task.clean = {
    '': ['--quiet']
  };
}
