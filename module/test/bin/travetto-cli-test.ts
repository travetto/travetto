import * as os from 'os';
import { Util, CompletionConfig } from '@travetto/cli/src/util';

export function init() {
  const Col = Util.colorize;

  return Util.program.command('test')
    .arguments('[regexes...]')
    .option('-f, --format <format>', 'Output format for test results', /^(tap|json|jsonStream|noop|exec|event)$/, 'tap')
    .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', /^[1-32]$/, Math.min(4, os.cpus().length - 1))
    .option('-m, --mode <mode>', 'Test run mode', /^(single|all)$/, 'all')
    .action(async (args, cmd) => {

      const { runTests, prepareEnv } = await import('./lib');

      prepareEnv();

      const { PhaseManager } = await import('@travetto/base');
      await PhaseManager.init('bootstrap', 'compiler').run();

      if (cmd.format === 'tap' && Util.HAS_COLOR) {
        const { TapEmitter } = await import('../src/consumer/tap');
        cmd.consumer = new TapEmitter(process.stdout, {
          assertDescription: Col.description,
          testDescription: Col.description,
          success: Col.success,
          failure: Col.failure,
          assertNumber: Col.identifier,
          testNumber: Col.identifier,
          assertFile: Col.path,
          assertLine: Col.input,
          objectInspect: Col.output,
          suiteName: Col.subtitle,
          testName: Col.title,
          total: Col.title
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
  const formats = ['tap', 'json', 'event'];
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