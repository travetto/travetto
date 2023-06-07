import { EventEmitter } from 'events';

import { GlobalEnvConfig, ShutdownManager } from '@travetto/base';
import { CliCommand } from '@travetto/cli';

/** Test child worker target */
@CliCommand({ hidden: true })
export class TestChildWorkerCommand {
  envInit(): GlobalEnvConfig {
    EventEmitter.defaultMaxListeners = 1000;
    return { test: true, set: { FORCE_COLOR: 0 } };
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