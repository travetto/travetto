import { EventEmitter } from 'node:events';

import { Env, RuntimeIndex } from '@travetto/runtime';
import { CliCommandShape, CliCommand, CliUtil } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';
import { Max, Min } from '@travetto/schema';

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

  /**
   * Tags to target or exclude when using globs
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

  async preValidate(): Promise<void> {
    const { selectConsumer } = await import('./bin/run.ts');
    await selectConsumer(this);
  }

  async main(first: string = '**/*', globs: string[] = []): Promise<void> {
    const { runTests } = await import('./bin/run.ts');

    const importPath = RuntimeIndex.getFromImportOrSource(first)?.import;

    return runTests(
      {
        concurrency: this.concurrency,
        consumer: this.format,
        consumerOptions: CliUtil.readExtendedOptions(this.formatOptions),
      },
      importPath ? {
        import: importPath,
        classId: globs[0],
        methodNames: globs.slice(1),
      } : {
        globs: [first, ...globs],
        tags: this.tags,
      }
    );
  }
}