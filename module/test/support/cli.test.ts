import fs from 'fs/promises';
import os from 'os';

import { path } from '@travetto/manifest';
import { GlobalEnvConfig } from '@travetto/base';
import { CliCommandShape, CliCommand } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';
import { Max, Min, Required, ValidationError } from '@travetto/schema';

type TestMode = 'single' | 'standard';
type TestFormat = 'tap' | 'tap-streamed' | 'xunit' | 'event' | 'exec';

/**
 * Launch test framework and execute tests
 */
@CliCommand()
export class TestCommand implements CliCommandShape {
  /** Output format for test results */
  format: TestFormat = 'tap';
  /** Number of tests to run concurrently */
  @Min(1) @Max(os.cpus().length)
  concurrency: number = WorkPool.DEFAULT_SIZE;
  /** Test run mode */
  mode: TestMode = 'standard';

  envInit(): GlobalEnvConfig {
    return { test: true };
  }

  isFirstFile(first: string): Promise<boolean> {
    return fs.stat(path.resolve(first ?? '')).then(x => x.isFile(), () => false);
  }

  async resolvedMode(first: string, rest: string[]): Promise<TestMode> {
    return (await this.isFirstFile(first)) && rest.length === 0 ? 'single' : this.mode;
  }

  async validate(first: string = 'test/.*', rest: string[]): Promise<ValidationError | undefined> {

    const mode = await this.resolvedMode(first, rest);

    if (mode === 'single' && !await this.isFirstFile(first)) {
      return {
        message: 'You must specify a proper test file to run in single mode',
        kind: 'required',
        path: 'regexes'
      };
    } else if (!/test\//.test(first)) {
      return {
        message: 'Only files in the test/ folder are permitted to be run',
        kind: 'required',
        path: 'regexes'
      };
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