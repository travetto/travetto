import * as commander from 'commander';
import * as os from 'os';
import * as fs from 'fs';

import { AppCache, EnvUtil, FsUtil, SourceIndex } from '@travetto/boot';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

import type { RunState } from '../src/execute/types';
import { SystemUtil } from '@travetto/base/src/internal/system';

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
      .option('-m, --mode <mode>', 'Test run mode', /^(single|isolated|standard)$/, 'standard');
  }

  async isFile(file: string) {
    try {
      const stat = await FsUtil.exists(file);
      return stat?.isFile();
    } catch {
      return false;
    }
  }

  async onIsolated(state: Partial<RunState>, file: string) {
    await this.onSingle(state, file);

    const modules = (await fs.promises.readFile(file, 'utf8'))
      .split(/\n/g)
      .filter(l => l.includes('@file-if'))
      .map(x => x.split('@file-if')[1].trim())
      .filter(x => x.startsWith('@travetto'))
      .join(',');

    // Reset
    // TODO: Cleanup
    process.env.TRV_MODULES = modules;
    process.env.TRV_CACHE = `.trv_cache_${SystemUtil.naiveHash(modules)}`;
    delete require.cache[require.resolve('../../boot/dev-register')];
    require('../../boot/dev-register');
    process.env.TRV_SRC_LOCAL = `^${file.split('/')[0]}`;
    delete EnvUtil['DYNAMIC_MODULES'];
    SourceIndex.reset();
    AppCache.init();
  }

  async onSingle(state: Partial<RunState>, file: string) {
    if (!(await this.isFile(file)) || !/test(-[^/]+)?\//.test(file)) {
      await this.showHelp(`You must specify a proper test file to run in single mode`);
    }
    state.mode = 'single';
  }

  async onStandard(state: Partial<RunState>, args: string[]) {
    const [first] = args;
    const isFile = await this.isFile(first);

    if (args.length === 0) {
      state.args = ['test/.*'];
    } else if (isFile) { // If is a single file
      if (first.startsWith('test/')) {
        await this.onSingle(state, first);
      } else if (first.startsWith('test-')) {
        await this.onIsolated(state, first);
      } else {
        await this.showHelp('Only files in the test/ and test-*/ folders are permitted to be run');
      }
    }
  }

  async action(args: string[]): Promise<void> {
    const { runTests } = await import('./lib');

    const [first] = args;

    const state: Partial<RunState> = {
      args,
      mode: this._cmd.mode,
      concurrency: +this._cmd.concurrency,
      format: this._cmd.format
    };

    switch (state.mode) {
      case 'single': await this.onSingle(state, first); break;
      case 'isolated': await this.onIsolated(state, first); break;
      case 'standard': await this.onStandard(state, args); break;
    }

    const res = await runTests(state as RunState);
    process.exit(res);
  }

  complete() {
    const formats = ['tap', 'json', 'event', 'xunit'];
    const modes = ['single', 'isolated', 'standard'];
    return {
      '': ['--format', '--mode'],
      '--format': formats,
      '-f': formats,
      '--mode': modes,
      '-m': modes
    };
  }
}