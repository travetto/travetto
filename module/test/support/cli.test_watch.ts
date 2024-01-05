import { Env, ExecUtil } from '@travetto/base';
import { CliCommand, CliUtil } from '@travetto/cli';

import { TestFormat } from './bin/types';

/**
 * Invoke the test watcher
 */
@CliCommand()
export class TestWatcherCommand {

  format: TestFormat = 'tap';
  mode: 'all' | 'change' = 'all';

  preMain(): void {
    Env.TRV_ROLE.set('test');
    Env.TRV_DYNAMIC.set(true);
  }

  async main(): Promise<void> {
    if (await CliUtil.runWithRestart(this)) {
      return;
    }

    process.once('disconnect', () => ExecUtil.kill(process));

    try {
      const { TestWatcher } = await import('../src/execute/watcher.js');
      await TestWatcher.watch(this.format, this.mode === 'all');
    } catch (err) {
      console.error(err);
    }
  }
}