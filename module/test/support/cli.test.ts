import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Env } from '@travetto/runtime';
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
  concurrency: number = WorkPool.DEFAULT_SIZE;
  /** Test run mode */
  mode: TestMode = 'standard';
  /**
   * Tags to target or exclude
   * @alias env.TRV_TEST_TAGS
   */
  tags?: string[];

  preMain(): void {
    EventEmitter.defaultMaxListeners = 1000;
    Env.TRV_ROLE.set('test');
    Env.TRV_ENV.set('test');
    Env.DEBUG.set(false);
    Env.TRV_LOG_PLAIN.set(true);
    Env.TRV_LOG_TIME.clear();
  }

  isFirstFile(first: string): Promise<boolean> {
    return fs.stat(path.resolve(first ?? '')).then(x => x.isFile(), () => false);
  }

  async resolvedMode(first: string, rest: string[]): Promise<TestMode> {
    return (await this.isFirstFile(first)) && rest.length === 0 ? 'single' : this.mode;
  }

  async validate(first: string = '**/*', rest: string[]): Promise<CliValidationError | undefined> {

    const mode = await this.resolvedMode(first, rest);

    if (mode === 'single' && !await this.isFirstFile(first)) {
      return { message: 'You must specify a proper test file to run in single mode', source: 'arg' };
    }
  }

  async main(first: string = '**/*', globs: string[] = []): Promise<void> {
    const { runTests } = await import('./bin/run');

    const isFirst = await this.isFirstFile(first);
    const isSingle = this.mode === 'single' || (isFirst && globs.length === 0);

    return runTests({
      concurrency: this.concurrency,
      format: this.format,
      tags: this.tags,
      target: isSingle ?
        {
          import: first,
          classId: globs[0],
          methodNames: globs.slice(1),
        } :
        { globs: [first, ...globs], }
    });
  }
}