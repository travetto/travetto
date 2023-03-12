import { readFileSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';

import { path, RootIndex } from '@travetto/manifest';
import { GlobalEnvConfig } from '@travetto/base';
import { BaseCliCommand, CliCommand, CliHelp } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';
import { Max, Min } from '@travetto/schema';

import type { RunState } from '../src/execute/types';

type TestMode = 'single' | 'standard';
type TestFormat = 'tap' | 'tap-streamed' | 'xunit' | 'event' | 'exec';

/**
 * Launch test framework and execute tests
 */
@CliCommand()
export class TestCommand implements BaseCliCommand {
  #types: string[];

  /** Output format for test results */
  format: TestFormat = 'tap';
  /** Number of tests to run concurrently */
  @Min(1) @Max(os.cpus().length)
  concurrency: number = WorkPool.DEFAULT_SIZE;
  /** Test run mode */
  mode: TestMode = 'standard';

  getTypes(): string[] {
    if (!this.#types) {
      this.#types = RootIndex
        .findSrc({ filter: /consumer\/types\/.*/, profiles: ['test'] })
        .map(x => readFileSync(`${x.outputFile}`, 'utf8').match(/Consumable.?[(]'([^']+)/)?.[1])
        .filter((x?: string): x is string => !!x);
    }
    return this.#types;
  }

  envInit(): GlobalEnvConfig {
    return { test: true };
  }

  getArgs(): string {
    return '[regexes...]';
  }

  async action(regexes: string[]): Promise<void | CliHelp> {
    const { runTests } = await import('./bin/run.js');

    const [first] = regexes;

    const isFile = await fs.stat(path.resolve(first ?? '')).then(x => x.isFile(), () => false);

    const state: RunState = {
      args: !first ? ['test/.*'] : regexes,
      mode: isFile && regexes.length === 1 ? 'single' : this.mode,
      concurrency: this.concurrency,
      format: this.format
    };

    if (state.mode === 'single') {
      if (!isFile) {
        return new CliHelp('You must specify a proper test file to run in single mode');
      } else if (!/test\//.test(first)) {
        return new CliHelp('Only files in the test/ folder are permitted to be run');
      }
    }

    await runTests(state);
  }
}