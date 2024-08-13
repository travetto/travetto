import { fork } from 'node:child_process';

import { Env, RuntimeIndex } from '@travetto/runtime';
import { ParentCommChannel } from '@travetto/worker';

import { Events, RunEvent, RunRequest } from './types';
import { TestConsumer } from '../consumer/types';
import { SerializeUtil } from '../consumer/serialize';
import { TestEvent } from '../model/event';

/**
 *  Produce a handler for the child worker
 */
export async function buildStandardTestManager(consumer: TestConsumer, imp: string | RunRequest): Promise<void> {
  let event: RunEvent;
  process.send?.({ type: 'log', message: `Worker Input ${JSON.stringify(imp)}` });

  if (typeof imp === 'string') {
    event = { import: imp };
  } else if ('file' in imp) {
    event = { import: RuntimeIndex.getFromSource(imp.file)?.import!, class: imp.class, method: imp.method };
  } else {
    event = imp;
  }

  process.send?.({ type: 'log', message: `Worker Executing ${event.import}` });

  const { module } = RuntimeIndex.getFromImport(event.import!)!;
  const suiteMod = RuntimeIndex.getModule(module);

  const channel = new ParentCommChannel<TestEvent & { error?: Error }>(
    fork(
      RuntimeIndex.resolveFileImport('@travetto/cli/support/entry.trv'), ['test:child'],
      {
        cwd: suiteMod!.sourcePath,
        env: {
          ...process.env,
          ...Env.TRV_MANIFEST.export(suiteMod!.outputPath),
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
      await consumer.onEvent(ev);  // Connect the consumer with the event stream from the child
    } catch {
      // Do nothing
    }
  });

  // Listen for child to complete
  const complete = channel.once(Events.RUN_COMPLETE);
  // Start test
  channel.send(Events.RUN, event);

  // Wait for complete
  const { error } = await complete;

  // Kill on complete
  await channel.destroy();

  process.send?.({ type: 'log', message: `Worker Finished ${event.import}` });

  // If we received an error, throw it
  if (error) {
    throw SerializeUtil.deserializeError(error);
  }
}