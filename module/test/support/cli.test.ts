import { readFileSync } from 'fs';
import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';
import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand, OptionConfig } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';

import type { RunState } from '../src/execute/types';

const modes = ['single', 'standard'] as const;

type Options = {
  format: OptionConfig<string>;
  concurrency: OptionConfig<number>;
  mode: OptionConfig<(typeof modes)[number]>;
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

  async action(regexes: string[]): Promise<void> {
    const { runTests } = await import('./bin/run.js');

    const [first] = regexes;

    const isFile = await fs.stat(path.resolve(first ?? '')).then(x => x.isFile(), () => false);

    const state: RunState = {
      args: !first ? ['test/.*'] : regexes,
      mode: isFile && regexes.length === 1 ? 'single' : this.cmd.mode,
      concurrency: this.cmd.concurrency,
      format: this.cmd.format
    };

    if (state.mode === 'single') {
      if (!isFile) {
        return this.showHelp('You must specify a proper test file to run in single mode');
      } else if (!/test\//.test(first)) {
        return this.showHelp('Only files in the test/ folder are permitted to be run');
      }
    }

    await runTests(state);
  }
}