import '@arcsine/nodesh';
import * as cp from 'child_process';

import type { TestEvent } from '@travetto/test';

import { Git } from './package/git';
import { Packages } from './package/packages';
import { Util } from './package/util';

async function run(): Promise<boolean> {
  console.error('Starting tests');
  const { TestConsumerRegistry } = await import('@travetto/test/src/consumer/registry');
  await TestConsumerRegistry.manualInit();

  const emitter = await TestConsumerRegistry.getInstance(process.env.TRV_TEST_FORMAT || 'tap');
  const { RunnableTestConsumer } = await import('@travetto/test/src/consumer/types/runnable');

  const consumer = new RunnableTestConsumer(emitter);

  return (process.env.TRV_ALL === '1' ? Packages.yieldPublicPackages() : Git.yieldChangedPackages())
    .$parallel(async p => {
      const args = ['test', '-f', 'exec', '-c', '3'];
      const proc = cp.spawn('trv', args, { cwd: p._.folder, stdio: [0, 'pipe', 2, 'ipc'], shell: false });
      const result = Util.enhanceProcess(proc, 'trv test');

      proc.on('message', (ev: TestEvent) => consumer.onEvent(ev));
      proc.on('error', e => {
        console.error(e);
        proc.kill('SIGTERM');
      });
      await result;
    }, { concurrent: 4 }).then(x => consumer.summarizeAsBoolean());
}

run();