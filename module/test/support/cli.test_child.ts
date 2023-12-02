import { EventEmitter } from 'events';

import { Env, ShutdownManager } from '@travetto/base';
import { CliCommand } from '@travetto/cli';

/** Test child worker target */
@CliCommand({ hidden: true })
export class TestChildWorkerCommand {
  preMain(): void {
    EventEmitter.defaultMaxListeners = 1000;
    Env.set({
      TRV_ROLE: 'test',
      TRV_ENV: 'test',
      FORCE_COLOR: false,
      TRV_LOG_PLAIN: true,
      TRV_LOG_TIME: undefined
    });
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