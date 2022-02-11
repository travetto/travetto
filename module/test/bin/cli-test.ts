import * as os from 'os';
import { readFileSync } from 'fs';

import { FsUtil, PathUtil, ScanFs } from '@travetto/boot';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { EnvInit } from '@travetto/base/bin/init';

import type { RunState } from '../src/execute/types';

const modes = ['single', 'standard'] as const;

/**
 * Launch test framework and execute tests
 */
export class TestPlugin extends BasePlugin {
  name = 'test';
  _types: string[];

  getTypes() {
    if (!this._types) {
      this._types = ScanFs.scanDirSync({},
        PathUtil.resolveUnix(__dirname, '..', 'src/consumer/types/')
      )
        .filter(x => x.stats.isFile())
        .map(x => readFileSync(x.file, 'utf8').match(/@Consumable[(]'([^']+)/)?.[1] as string);
    }
    return this._types;
  }

  getOptions() {
    return {
      format: this.choiceOption({ desc: 'Output format for test results', def: 'tap', choices: this.getTypes() }),
      concurrency: this.intOption({ desc: 'Number of tests to run concurrently', lower: 1, upper: 32, def: Math.min(4, os.cpus().length - 1) }),
      isolated: this.boolOption({ desc: 'Isolated mode' }),
      mode: this.choiceOption({ desc: 'Test run mode', def: 'standard', choices: [...modes] })
    };
  }

  envInit() {
    EnvInit.init({
      debug: '0',
      set: { TRV_LOG_TIME: '0' },
      append: {
        TRV_RESOURCES: 'test/resources',
        TRV_PROFILES: 'test',
        TRV_SRC_LOCAL: '^test',
        TRV_SRC_COMMON: '^test-support'
      }
    });
  }

  getArgs() {
    return '[regexes...]';
  }

  async isFile(file: string, errorIfNot?: string) {
    try {
      const stat = await FsUtil.exists(file);
      const res = stat?.isFile();
      if (res) {
        return true;
      }
    } catch { }

    if (errorIfNot) {
      await this.showHelp(errorIfNot);
    }
  }

  async onSingle(state: Partial<RunState>, file: string) {
    await this.isFile(file, 'You must specify a proper test file to run in single mode');
    state.mode = 'single';
  }

  async onStandard(state: Partial<RunState>, first: string) {
    const isFile = await this.isFile(first);

    if (!first) {
      state.args = state.isolated ? ['test-isolated/.*'] : ['test/.*'];
      state.concurrency = (state.isolated ? 1 : undefined) ?? state.concurrency;
    } else if (isFile) { // If is a single file
      if (first.startsWith('test-')) {
        state.isolated = true;
      }
      if (/test(\-[^-]+)?\//.test(first)) {
        await this.onSingle(state, first);
      } else {
        await this.showHelp('Only files in the test/ and test-*/ folders are permitted to be run');
      }
    }
  }

  async action(regexes: string[]): Promise<void> {
    const { runTests } = await import('./lib/run');

    const [first] = regexes;

    const state: Partial<RunState> = {
      args: regexes,
      mode: this.cmd.mode,
      concurrency: +this.cmd.concurrency,
      isolated: this.cmd.isolated,
      format: this.cmd.format
    };

    switch (state.mode) {
      case 'single': await this.onSingle(state, first); break;
      case 'standard': await this.onStandard(state, first); break;
    }

    await runTests(state as RunState);
  }
}