import { EventEmitter } from 'node:events';

import { CliCommand } from '@travetto/cli';
import { Env } from '@travetto/runtime';
import { IsPrivate } from '@travetto/schema';

/**
 * Internal command target for test child workers.
 *
 * Used by the test runner to bootstrap isolated worker processes with test-
 * oriented runtime configuration.
 */
@CliCommand({ supportDebug: false })
@IsPrivate()
export class TestChildWorkerCommand {
  async main(): Promise<void> {
    EventEmitter.defaultMaxListeners = 1000;
    Env.TRV_ROLE.set('test');
    Env.FORCE_COLOR.set(false);
    Env.TRV_LOG_PLAIN.set(true);
    Env.TRV_LOG_TIME.clear();

    process.once('disconnect', () => process.exit());
    const { TestChildWorker } = await import('../src/worker/child.ts');
    return new TestChildWorker().activate();
  }
}
