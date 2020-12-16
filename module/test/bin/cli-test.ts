import * as commander from 'commander';
import * as os from 'os';

import { FsUtil } from '@travetto/boot';
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
      .option('-m, --mode <mode>', 'Test run mode', /^(single|extension)$/, '');
  }

  async action(args: string[]) {
    const { runTests } = await import('./lib');

    const state: Partial<RunState> = {
      args,
      mode: this._cmd.mode,
      concurrency: +this._cmd.concurrency,
      format: this._cmd.format
    };

    switch (state.mode) {
      case 'single': {
        if (args.length < 1 && state.mode === 'single') {
          await this.showHelp('You must specify a file to run in single mode');
        }
        break;
      }
      case 'extension': {
        state.concurrency = 1;
        if (args.length === 0) {
          state.args = ['test/.*'];
        }
        break;
      }
      case undefined: {
        if (args.length === 0) {
          state.args = ['test/.*'];
        } else if (state.concurrency === 1) {
          state.mode = 'single';
        } else if ((await FsUtil.exists(args[0]))?.isFile() && /^\d+/.test(args[1])) { // If is a single file and specifying a line
          state.mode = 'single';
        }
      }
    }

    const res = await runTests(state as RunState);
    process.exit(res);
  }

  complete() {
    const formats = ['tap', 'json', 'event', 'xunit'];
    const modes = ['single', 'extension'];
    return {
      '': ['--format', '--mode'],
      '--format': formats,
      '-f': formats,
      '--mode': modes,
      '-m': modes
    };
  }
}