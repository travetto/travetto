import { EventEmitter } from 'events';

import { Env, ShutdownManager } from '@travetto/base';
import { CliCommand } from '@travetto/cli';

/** Test child worker target */
@CliCommand({ hidden: true })
export class TestChildWorkerCommand {
  preMain(): void {
    EventEmitter.defaultMaxListeners = 1000;
    Env.TRV_ROLE.set('test');
    Env.TRV_ENV.set('test');
    Env.FORCE_COLOR.set(false);
    Env.TRV_LOG_PLAIN.set(true);
    Env.TRV_LOG_TIME.clear();
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