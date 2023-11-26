import { EventEmitter } from 'events';

import { defineEnv, ShutdownManager } from '@travetto/base';
import { CliCommand } from '@travetto/cli';

/** Test child worker target */
@CliCommand({ hidden: true })
export class TestChildWorkerCommand {
  preMain(): void {
    EventEmitter.defaultMaxListeners = 1000;
    process.env.FORCE_COLOR = '0';
    defineEnv({ envName: 'test' });
  }

  async main(): Promise<void> {
    if (process.send) {
      // Shutdown when ipc bridge is closed
      process.on('disconnect', () => ShutdownManager.execute());
    }
    const { TestChildWorker } = await import('../src/worker/child.js');
    return new TestChildWorker().activate();
  }
}