import { fork } from 'node:child_process';

import { Env, RuntimeIndex, Util } from '@travetto/runtime';
import { IpcChannel } from '@travetto/worker';

import { Events, type TestLogEvent } from './types.ts';
import type { TestConsumerShape } from '../consumer/types.ts';
import type { TestEvent, TestRemoveEvent } from '../model/event.ts';
import type { TestDiffInput, TestRun } from '../model/test.ts';

const log = (message: string | TestLogEvent): void => {
  const event: TestLogEvent = typeof message === 'string' ? { type: 'log', message } : message;
  process.send ? process.send?.(event) : console.log(event.message);
};

/**
 *  Produce a handler for the child worker
 */
export async function buildStandardTestManager(consumer: TestConsumerShape, run: TestRun | TestDiffInput): Promise<void> {
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

  channel.on('*', async event => {
    try {
      const parsed: TestEvent | TestRemoveEvent | TestLogEvent = Util.deserializeFromJson(JSON.stringify(event));
      if (parsed.type === 'log') {
        log(parsed);
      } else if (parsed.type === 'removeTest') {
        log(`Received remove event ${JSON.stringify(event)}@${consumer.constructor.name}`);
        await consumer.onRemoveEvent?.(parsed); // Forward remove events
      } else {
        await consumer.onEvent(parsed);  // Forward standard events
      }
    } catch {
      // Do nothing
    }
  });

  // Listen for child to complete
  const complete = channel.once(Events.RUN_COMPLETE);
  // Start test
  channel.send(Events.RUN, run);

  // Wait for complete
  const result = await complete.then(event => Util.deserializeFromJson<typeof event>(JSON.stringify(event)));

  // Kill on complete
  await channel.destroy();

  log(`Worker Finished ${run.import}`);

  // If we received an error, throw it
  if (result.error) {
    throw result.error;
  }
}