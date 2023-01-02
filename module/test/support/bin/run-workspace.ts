
import { ExecUtil } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { CliModuleUtil } from '@travetto/cli/src/module';

import { TestConsumerRegistry } from '../../src/consumer/registry';
import { RunnableTestConsumer } from '../../src/consumer/types/runnable';
import { SummaryEmitter } from '../../src/consumer/types/tap-summary';
import { TestEvent } from '../../src/model/event';

export async function runWorkspace(format: string, workerCount: number): Promise<void> {

  const emitter = format === 'summary' ?
    new SummaryEmitter(process.stdout) :
    await TestConsumerRegistry.getInstance(format);

  const consumer = new RunnableTestConsumer(emitter);

  // Ensure services are healthy
  if (RootIndex.hasModule('@travetto/command')) {
    await ExecUtil.spawn('trv', ['service', 'start'], { stdio: 'ignore' }).result;
  }

  if (emitter instanceof SummaryEmitter) {
    const onEvent = emitter.onEvent.bind(emitter);
    emitter.onEvent = (ev: TestEvent): void => {
      if (ev.type === 'test' && ev.phase === 'after') {
        process.stderr.write(`Test: ${ev.test.classId} ${ev.test.methodName} - ${ev.test.status}\n`);
      }
      onEvent(ev);
    };
  }

  await CliModuleUtil.runOnModules(
    'changed',
    ['trv', 'test', '-f', 'exec', '-c', '3'],
    {
      showStdout: false,
      showStderr: false,
      showProgress: format === 'summary',
      progressBar: 'bottom',
      filter: folder => !!(RootIndex.getModuleByFolder(folder)?.files.test.length ?? 0),
      onMessage: (folder, ev: TestEvent) => consumer.onEvent(ev),
      workerCount,
    }
  );

  process.exit(consumer.summarizeAsBoolean() ? 0 : 1);
}