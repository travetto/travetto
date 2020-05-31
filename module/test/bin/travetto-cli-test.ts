import * as commander from 'commander';
import * as os from 'os';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import type { RunState } from '../src/runner/types';

/**
 * Launch test framework and execute tests
 */
export class TestPlugin extends BasePlugin {
  name = 'test';

  init(cmd: commander.Command) {
    return cmd
      .arguments('[regexes...]')
      .option('-f, --format <format>', 'Output format for test results', /^(tap|json|noop|exec|event|xunit)$/, 'tap')
      .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', /^[1-32]$/, `${Math.min(4, os.cpus().length - 1)}`)
      .option('-m, --mode <mode>', 'Test run mode', /^(single|all)$/, 'all');
  }

  async action(args: string[]) {
    const { runTests } = await import('./lib');

    const state: Partial<RunState> = {
      args,
      mode: this._cmd.mode,
      concurrency: +this._cmd.concurrency,
      format: this._cmd.format
    };

    if (state.mode === 'all') {
      if (args.length === 0) {
        state.args = ['test/.*'];
      } else if (state.concurrency === 1) {
        state.mode = 'single';
      }
    } else if (args.length < 1 && state.mode === 'single') {
      this.showHelp('You must specify a file to run in single mode');
    }

    const res = await runTests(state as RunState);
    process.exit(res);
  }

  complete() {
    const formats = ['tap', 'json', 'event', 'xunit'];
    const modes = ['single', 'all'];
    return {
      '': ['--format', '--mode'],
      '--format': formats,
      '-f': formats,
      '--mode': modes,
      '-m': modes
    };
  }
}