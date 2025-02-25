import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Env } from '@travetto/runtime';
import { CliCommandShape, CliCommand, CliValidationError } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';
import { Max, Min } from '@travetto/schema';

import { selectConsumer } from './bin/run.ts';

/**
 * Launch test framework and execute tests
 */
@CliCommand()
export class TestCommand implements CliCommandShape {

  /** Output format for test results */
  format: string = 'tap';

  /** Number of tests to run concurrently */
  @Min(1) @Max(WorkPool.MAX_SIZE)
  concurrency: number = WorkPool.DEFAULT_SIZE;

  /** Test run mode */
  mode: 'single' | 'standard' = 'standard';

  /**
   * Tags to target or exclude
   * @alias env.TRV_TEST_TAGS
   */
  tags?: string[];

  /**
   * Format options
   * @alias o
   */
  formatOptions?: string[];

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

  async resolvedMode(first: string, rest: string[]): Promise<string> {
    return (await this.isFirstFile(first)) && rest.length === 0 ? 'single' : this.mode;
  }

  async preValidate(): Promise<void> {
    await selectConsumer(this);
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
    const options = Object.fromEntries((this.formatOptions ?? [])?.map(f => [...f.split(':'), true]));

    return runTests({
      concurrency: this.concurrency,
      consumer: this.format,
      consumerOptions: options,
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