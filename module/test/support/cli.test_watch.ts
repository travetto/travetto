import { Env } from '@travetto/runtime';
import { CliCommand, CliUtil } from '@travetto/cli';

import { selectConsumer } from './bin/run.ts';

/**
 * Invoke the test watcher
 */
@CliCommand()
export class TestWatcherCommand {

  format: string = 'tap';
  mode: 'all' | 'change' = 'all';

  async preValidate(): Promise<void> {
    await selectConsumer(this);
  }

  preMain(): void {
    Env.TRV_ROLE.set('test');
  }

  async main(): Promise<void> {
    if (await CliUtil.runWithRestart(this, true)) {
      return;
    }

    try {
      const { TestWatcher } = await import('../src/execute/watcher.ts');
      await TestWatcher.watch(this.format, this.mode === 'all');
    } catch (error) {
      console.error(error);
    }
  }
}