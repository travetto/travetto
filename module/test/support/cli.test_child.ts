import { EventEmitter } from 'node:events';

import { Env } from '@travetto/runtime';
import { CliCommand } from '@travetto/cli';
import { IsPrivate } from '@travetto/schema';

/** Test child worker target */
@CliCommand()
@IsPrivate()
export class TestChildWorkerCommand {
  preMain(): void {
    EventEmitter.defaultMaxListeners = 1000;
    Env.TRV_ROLE.set('test');
    Env.TRV_ENV.set('test');
    Env.DEBUG.set(false);
    Env.FORCE_COLOR.set(false);
    Env.TRV_LOG_PLAIN.set(true);
    Env.TRV_LOG_TIME.clear();
  }

  async main(): Promise<void> {
    process.once('disconnect', () => process.exit());
    const { TestChildWorker } = await import('../src/worker/child.ts');
    return new TestChildWorker().activate();
  }
}