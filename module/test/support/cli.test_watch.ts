import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand } from '@travetto/cli';

import { TestFormat } from './bin/types';

/**
 * Invoke the test watcher
 */
@CliCommand()
export class TestWatcherCommand {

  format: TestFormat = 'tap';
  mode: 'all' | 'change' = 'all';

  envInit(): GlobalEnvConfig {
    return { envName: 'test', dynamic: true };
  }

  async main(): Promise<void> {
    // Quit on parent disconnect
    if (process.send) {
      process.on('disconnect', () => process.exit(0));
    }

    try {
      const { TestWatcher } = await import('../src/execute/watcher.js');
      console.log('Starting');
      await TestWatcher.watch(this.format, this.mode === 'all');
      console.log('Done');
    } catch (err) {
      console.error(err);
    }
  }
}