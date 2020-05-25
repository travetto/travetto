import * as os from 'os';
import { CliUtil } from '@travetto/cli/src/util';
import { CompletionConfig } from '@travetto/cli/src/types';

/**
 * Launch test framework and execute tests
 */
export function init() {
  return CliUtil.program.command('test')
    .arguments('[regexes...]')
    .option('-f, --format <format>', 'Output format for test results', /^(tap|json|noop|exec|event|xunit)$/, 'tap')
    .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', /^[1-32]$/, `${Math.min(4, os.cpus().length - 1)}`)
    .option('-m, --mode <mode>', 'Test run mode', /^(single|all)$/, 'all')
    .action(async (args, cmd) => {

      const { runTests, load } = await import('./lib');

      await load();

      if (cmd.mode === 'all') {
        if (args.length === 0) {
          args = ['test/.*'];
        } else if (cmd.concurrency === '1') {
          cmd.mode = 'single';
        }
      } else if (args.length < 1 && cmd.mode === 'single') {
        CliUtil.showHelp(cmd, 'You must specify a file to run in single mode');
      }

      cmd.args = args;

      const res = await runTests(cmd);
      process.exit(res);
    });
}

export function complete(c: CompletionConfig) {
  const formats = ['tap', 'json', 'event', 'xunit'];
  const modes = ['single', 'all'];
  c.all.push('test');
  c.task.test = {
    '': ['--format', '--mode'],
    '--format': formats,
    '-f': formats,
    '--mode': modes,
    '-m': modes
  };
}