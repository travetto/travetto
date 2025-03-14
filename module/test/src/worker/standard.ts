import { fork } from 'node:child_process';

import { Env, RuntimeIndex, Util } from '@travetto/runtime';
import { IpcChannel } from '@travetto/worker';

import { Events, TestLogEvent } from './types.ts';
import { TestConsumerShape } from '../consumer/types.ts';
import { TestEvent } from '../model/event.ts';
import { TestRun } from '../model/test.ts';

const log = (message: string): void => {
  process.send?.({ type: 'log', message } satisfies TestLogEvent);
};

/**
 *  Produce a handler for the child worker
 */
export async function buildStandardTestManager(consumer: TestConsumerShape, run: TestRun): Promise<void> {
  log(`Worker Input ${JSON.stringify(run)}`);
  log(`Worker Executing ${run.import}`);

  const { module } = RuntimeIndex.getFromImport(run.import)!;
  const suiteMod = RuntimeIndex.getModule(module)!;

  const channel = new IpcChannel<TestEvent & { error?: Error }>(
    fork(
      RuntimeIndex.resolveFileImport('@travetto/cli/support/entry.trv.ts'), ['test:child'],
      {
        cwd: suiteMod.sourcePath,
        env: {
          ...process.env,
          ...Env.TRV_MANIFEST.export(suiteMod.outputPath),
          ...Env.TRV_QUIET.export(true)
        },
        stdio: ['ignore', 'ignore', 2, 'ipc']
      }
    )
  );

  await channel.once(Events.READY); // Wait for the child to be ready
  await channel.send(Events.INIT); // Initialize
  await channel.once(Events.INIT_COMPLETE); // Wait for complete

  channel.on('*', async ev => {
    try {
      await consumer.onEvent(Util.deserializeFromJson(JSON.stringify(ev)));  // Connect the consumer with the event stream from the child
    } catch {
      // Do nothing
    }
  });

  // Listen for child to complete
  const complete = channel.once(Events.RUN_COMPLETE);
  // Start test
  channel.send(Events.RUN, run);

  // Wait for complete
  const result = await complete.then(ev => Util.deserializeFromJson<typeof ev>(JSON.stringify(ev)));

  // Kill on complete
  await channel.destroy();

  log(`Worker Finished ${run.import}`);

  // If we received an error, throw it
  if (result.error) {
    throw result.error;
  }
}