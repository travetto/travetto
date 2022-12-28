import { readFileSync } from 'fs';
import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';
import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';

import type { RunState } from '../src/execute/types';

const modes = ['single', 'standard'] as const;

type Options = {
  format: OptionConfig<string>;
  concurrency: OptionConfig<number>;
  mode: OptionConfig<'single' | 'standard'>;
};

/**
 * Launch test framework and execute tests
 */
export class TestCommand extends CliCommand<Options> {
  name = 'test';
  _types: string[];

  getTypes(): string[] {
    if (!this._types) {
      this._types = RootIndex
        .findSrc({ filter: /consumer\/types\/.*/, profiles: ['test'] })
        .map(x => readFileSync(`${x.output}`, 'utf8').match(/Consumable.?[(]'([^']+)/)?.[1])
        .filter((x?: string): x is string => !!x);
    }
    return this._types;
  }

  getOptions(): Options {
    return {
      format: this.choiceOption({ desc: 'Output format for test results', def: 'tap', choices: this.getTypes() }),
      concurrency: this.intOption({ desc: 'Number of tests to run concurrently', lower: 1, upper: 32, def: WorkPool.DEFAULT_SIZE }),
      mode: this.choiceOption({ desc: 'Test run mode', def: 'standard', choices: [...modes] })
    };
  }

  envInit(): GlobalEnvConfig {
    return { test: true };
  }

  getArgs(): string {
    return '[regexes...]';
  }

  async isFile(file: string, errorIfNot?: string): Promise<true | undefined> {
    try {
      const stat = await fs.stat(path.resolve(file)).catch(() => { });
      const res = stat?.isFile();
      if (res) {
        return true;
      }
    } catch { }

    if (errorIfNot) {
      await this.showHelp(errorIfNot);
    }
  }

  async onSingle(state: Partial<RunState>, file: string): Promise<void> {
    await this.isFile(file, 'You must specify a proper test file to run in single mode');
    state.mode = 'single';
  }

  async onStandard(state: Partial<RunState>, first: string): Promise<void> {
    const isFile = await this.isFile(first);

    if (!first) {
      state.args = ['test/.*'];
    } else if (isFile) { // If is a single file
      if (/test\//.test(first)) {
        await this.onSingle(state, first);
      } else {
        await this.showHelp('Only files in the test/ folder are permitted to be run');
      }
    }
  }

  async action(regexes: string[]): Promise<void> {
    // If we are in a mono-repo, at root
    if (CliModuleUtil.isMonoRepoRoot()) {
      const { runWorkspace } = await import('./bin/run-workspace.js');
      await runWorkspace(this.cmd.format, +this.cmd.concurrency);
    } else {
      const { runTests } = await import('./bin/run.js');

      const [first] = regexes;

      const state: RunState = {
        args: regexes,
        mode: this.cmd.mode,
        concurrency: +this.cmd.concurrency,
        format: this.cmd.format
      };

      switch (state.mode) {
        case 'single': await this.onSingle(state, first); break;
        case 'standard': await this.onStandard(state, first); break;
      }

      await runTests(state);
    }
  }
}