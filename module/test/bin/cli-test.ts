import * as commander from 'commander';
import * as os from 'os';
import * as fs from 'fs';

import { FsUtil, ScanFs } from '@travetto/boot';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

import type { RunState } from '../src/execute/types';

/**
 * Launch test framework and execute tests
 */
export class TestPlugin extends BasePlugin {
  name = 'test';
  _types: string[];

  getTypes() {
    if (!this._types) {
      this._types = ScanFs.scanDirSync({},
        FsUtil.resolveUnix(__dirname, '..', 'src/consumer/types/')
      )
        .filter(x => x.stats.isFile())
        .map(x => fs.readFileSync(x.file, 'utf8').match(/@Consumable[(]'([^']+)/)?.[1] as string)
        .filter(x => x && x !== 'exec');
    }
    return this._types;
  }

  init(cmd: commander.Command) {
    return cmd
      .arguments('[regexes...]')
      .option('-f, --format <format>', 'Output format for test results', new RegExp(`^(${this.getTypes().join('|')})$`), 'tap')
      .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', /^[1-32]$/, `${Math.min(4, os.cpus().length - 1)}`)
      .option('-m, --mode <mode>', 'Test run mode', /^(single|isolated|standard)$/, 'standard');
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

  async onIsolated(state: Partial<RunState>, file: string) {
    await this.isFile(file, 'You must specify a proper test file to run in isolated mode');
    state.mode = 'isolated';
  }

  async onSingle(state: Partial<RunState>, file: string) {
    await this.isFile(file, 'You must specify a proper test file to run in single mode');
    state.mode = 'single';
  }

  async onStandard(state: Partial<RunState>, first: string) {
    const isFile = await this.isFile(first);

    if (!first) {
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
      case 'standard': await this.onStandard(state, first); break;
    }

    const res = await runTests(state as RunState);
    process.exit(res);
  }

  complete() {
    const formats = this.getTypes();
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