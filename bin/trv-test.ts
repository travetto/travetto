import '@arcsine/nodesh';
import { ExecUtil } from '@travetto/boot';
import { Modules } from './package/modules';

async function run(isolated = false) {
  const { TestConsumerRegistry } = await import('@travetto/test/src/consumer/registry');
  await TestConsumerRegistry.manualInit();

  const emitter = await TestConsumerRegistry.getInstance(process.env.TRV_TEST_FORMAT || 'tap');
  const { RunnableTestConsumer } = await import('@travetto/test/src/consumer/types/runnable');

  const consumer = new RunnableTestConsumer(emitter);

  return [...Object.keys(await Modules.byPath)]
    .$tap(console.log)
    .$parallel(async cwd => {
      const args = ['test', '-f', 'exec', ...(isolated ? ['-i'] : ['-c', '1'])];
      const { process: proc, result } = ExecUtil.spawn('trv', args, { cwd, stdio: [0, 'pipe', 2, 'ipc'] });
      proc.on('message', ev => consumer.onEvent(ev));
      await result;
    }, { concurrent: isolated ? 2 : 6 }).then(x => consumer.summarizeAsBoolean());
}

run();