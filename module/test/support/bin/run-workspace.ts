
import { ExecUtil } from '@travetto/base';
import { ModuleIndex } from '@travetto/boot';
import { CliModuleUtil } from '@travetto/cli/src/module';

import { TestConsumerRegistry } from '../../src/consumer/registry';
import { RunnableTestConsumer } from '../../src/consumer/types/runnable';
import { TestEvent } from '../../src/model/event';

export async function runWorkspace(format: string, workers: number): Promise<void> {

  const emitter = await TestConsumerRegistry.getInstance(format);
  const consumer = new RunnableTestConsumer(emitter);

  // Ensure services are healthy
  if (ModuleIndex.hasModule('@travetto/command')) {
    await ExecUtil.spawn('trv', ['command:service', 'start'], { stdio: 'ignore' }).result;
  }

  await CliModuleUtil.runOnModules(
    'changed',
    ['trv', 'test', '-f', 'exec', '-c', '3'],
    (folder, ev: TestEvent) => consumer.onEvent(ev),
    workers
  );

  process.exit(consumer.summarizeAsBoolean() ? 0 : 1);
}