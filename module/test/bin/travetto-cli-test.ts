import * as os from 'os';
import { Util, CompletionConfig } from '@travetto/cli/src/util';
import { Colors } from '@travetto/cli/src/color';

// TODO: Document
export function init() {
  return Util.program.command('test')
    .arguments('[regexes...]')
    .option('-f, --format <format>', 'Output format for test results', /^(tap|json|noop|exec|event|xunit)$/, 'tap')
    .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', /^[1-32]$/, Math.min(4, os.cpus().length - 1))
    .option('-m, --mode <mode>', 'Test run mode', /^(single|all)$/, 'all')
    .action(async (args, cmd) => {

      const { runTests, load } = await import('./lib');

      await load();
      const { Env } = await import('@travetto/base');

      if (cmd.format === 'tap' && Env.colorize) {
        const { TapEmitter } = await import('../src/consumer/types/tap');
        cmd.consumer = new TapEmitter(process.stdout, {
          assertDescription: Colors.description,
          testDescription: Colors.description,
          success: Colors.success,
          failure: Colors.failure,
          assertNumber: Colors.identifier,
          testNumber: Colors.identifier,
          assertFile: Colors.path,
          assertLine: Colors.input,
          objectInspect: Colors.output,
          suiteName: Colors.subtitle,
          testName: Colors.title,
          total: Colors.title
        });
      }

      if (cmd.mode === 'all') {
        if (args.length === 0) {
          args = ['test/.*'];
        } else if (cmd.concurrency === '1') {
          cmd.mode = 'single';
        }
      } else if (args.length < 1 && cmd.mode === 'single') {
        Util.showHelp(cmd, 'You must specify a file to run in single mode');
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