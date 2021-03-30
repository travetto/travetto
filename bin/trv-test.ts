import '@arcsine/nodesh';
import { ExecUtil } from '@travetto/boot';

import { Git } from './package/git';

async function run(isolated = false) {
  const { TestConsumerRegistry } = await import('@travetto/test/src/consumer/registry');
  await TestConsumerRegistry.manualInit();

  const emitter = await TestConsumerRegistry.getInstance(process.env.TRV_TEST_FORMAT || 'tap');
  const { RunnableTestConsumer } = await import('@travetto/test/src/consumer/types/runnable');

  const consumer = new RunnableTestConsumer(emitter);

  return Git.yieldChangedPackges()
    .$parallel(async p => {
      const args = ['test', '-f', 'exec', ...(isolated ? ['-i'] : ['-c', '1'])];
      const { process: proc, result } = ExecUtil.spawn('trv', args, { cwd: p._.folder, stdio: [0, 'pipe', 2, 'ipc'] });
      proc.on('message', ev => consumer.onEvent(ev));
      await result;
    }, { concurrent: isolated ? 2 : 6 }).then(x => consumer.summarizeAsBoolean());
}

run(/^true|1|yes|on$/.test(process.argv[2]));