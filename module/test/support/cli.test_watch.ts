import { Env } from '@travetto/runtime';
import { CliCommand } from '@travetto/cli';

import { TestFormatField } from './bin/decorator.ts';

/**
 * Invoke the test watcher
 */
@CliCommand()
export class TestWatcherCommand {

  @TestFormatField()
  format: string;

  mode: 'all' | 'change' = 'all';

  preMain(): void {
    Env.TRV_ROLE.set('test');
  }

  async main(): Promise<void> {
    try {
      const { TestWatcher } = await import('../src/execute/watcher.ts');
      await TestWatcher.watch(this.format, this.mode === 'all');
    } catch (error) {
      console.error(error);
    }
  }
}