import { EventEmitter } from 'events';
import fs from 'fs/promises';

import { path } from '@travetto/manifest';
import { GlobalEnvConfig } from '@travetto/base';
import { CliCommandShape, CliCommand, CliValidationError } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';
import { Max, Min } from '@travetto/schema';

import { TestFormat, TestMode } from './bin/types';

/**
 * Launch test framework and execute tests
 */
@CliCommand()
export class TestCommand implements CliCommandShape {
  /** Output format for test results */
  format: TestFormat = 'tap';
  /** Number of tests to run concurrently */
  @Min(1) @Max(WorkPool.MAX_SIZE)
  concurrency: number = WorkPool.MAX_SIZE;
  /** Test run mode */
  mode: TestMode = 'standard';

  envInit(): GlobalEnvConfig {
    EventEmitter.defaultMaxListeners = 1000;
    return { test: true };
  }

  isFirstFile(first: string): Promise<boolean> {
    return fs.stat(path.resolve(first ?? '')).then(x => x.isFile(), () => false);
  }

  async resolvedMode(first: string, rest: string[]): Promise<TestMode> {
    return (await this.isFirstFile(first)) && rest.length === 0 ? 'single' : this.mode;
  }

  async validate(first: string = 'test/.*', rest: string[]): Promise<CliValidationError | undefined> {

    const mode = await this.resolvedMode(first, rest);

    if (mode === 'single' && !await this.isFirstFile(first)) {
      return { message: 'You must specify a proper test file to run in single mode', source: 'arg' };
    } else if (!/test\//.test(first)) {
      return { message: 'Only files in the test/ folder are permitted to be run', source: 'arg' };
    }
  }

  async main(first: string = 'test/.*', regexes: string[] = []): Promise<void> {
    const { runTests } = await import('./bin/run.js');

    return runTests({
      args: [first, ...regexes],
      mode: await this.resolvedMode(first, regexes),
      concurrency: this.concurrency,
      format: this.format
    });
  }
}