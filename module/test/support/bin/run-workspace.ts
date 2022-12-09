
import { ExecUtil } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { CliModuleUtil } from '@travetto/cli/src/module';

import { TestConsumerRegistry } from '../../src/consumer/registry';
import { RunnableTestConsumer } from '../../src/consumer/types/runnable';
import { TestEvent } from '../../src/model/event';

export async function runWorkspace(format: string, workerCount: number): Promise<void> {

  const emitter = await TestConsumerRegistry.getInstance(format);
  const consumer = new RunnableTestConsumer(emitter);

  // Ensure services are healthy
  if (RootIndex.hasModule('@travetto/command')) {
    await ExecUtil.spawn('trv', ['service', 'start'], { stdio: 'ignore' }).result;
  }

  await CliModuleUtil.runOnModules(
    'changed',
    ['trv', 'test', '-f', 'exec', '-c', '3'],
    {
      onMessage: (folder, ev: TestEvent) => consumer.onEvent(ev),
      workerCount
    }
  );

  process.exit(consumer.summarizeAsBoolean() ? 0 : 1);
}