import { CliCommand } from '@travetto/cli';
import { Env } from '@travetto/runtime';

import type { TestConsumerType } from './bin/run.ts';

/**
 * Start the test watcher for continuous test execution.
 *
 * Watches project changes and reruns either all tests or changed subsets,
 * using the configured output format.
 */
@CliCommand()
export class TestWatcherCommand {
  /** Output format for test results */
  format: TestConsumerType = 'tap';

  mode: 'all' | 'change' = 'all';

  async main(): Promise<void> {
    Env.TRV_ROLE.set('test');

    try {
      const { TestWatcher } = await import('../src/execute/watcher.ts');
      await TestWatcher.watch(this.format, this.mode === 'all');
    } catch (error) {
      console.error(error);
    }
  }
}
