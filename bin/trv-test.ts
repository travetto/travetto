import '@arcsine/nodesh';

import { ExecUtil, FsUtil } from '@travetto/boot';
import type { TestEvent } from '@travetto/test';

import { Git } from './package/git';
import { Packages } from './package/packages';

async function run(isolated = false) {
  console.error(`Starting tests [isolated=${isolated}]`);
  const { TestConsumerRegistry } = await import('@travetto/test/src/consumer/registry');
  await TestConsumerRegistry.manualInit();

  const emitter = await TestConsumerRegistry.getInstance(process.env.TRV_TEST_FORMAT || 'tap');
  const { RunnableTestConsumer } = await import('@travetto/test/src/consumer/types/runnable');

  const consumer = new RunnableTestConsumer(emitter);

  return (process.env.TRV_ALL === '1' ? Packages.yieldPublicPackages() : Git.yieldChangedPackages())
    .$filter(async p => !isolated || !!(await FsUtil.exists(`${p._.folder}/test-isolated`)))
    .$parallel(async p => {
      const args = ['test', '-f', 'exec', ...(isolated ? ['-i'] : ['-c', '3'])];
      const { process: proc, result } = ExecUtil.spawn('trv', args, { cwd: p._.folder, stdio: [0, 'pipe', 2, 'ipc'] });

      proc.on('message', ev => consumer.onEvent(ev as TestEvent));
      proc.on('error', e => {
        console.error(e);
        proc.kill('SIGTERM');
      });
      await result;
    }, { concurrent: isolated ? 1 : 4 }).then(x => consumer.summarizeAsBoolean());
}

run(/^true|1|yes|on$/.test(process.argv[2]));