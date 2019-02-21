import { Env } from '@travetto/base';

import { Worker } from '@travetto/worker';
import { Events, TEST_BASE } from './types';

export async function workerFactory() {
  const worker = new Worker(`${TEST_BASE}/bin/travetto-test-worker`, [], true, {
    cwd: Env.cwd,
    env: {
      ...process.env,
      ...(process.env.NODE_PRESERVE_SYMLINKS === '1' ? { // Only pass base path if preserving symlinks
        TRV_TEST_BASE: TEST_BASE
      } : {}),
    }
  });

  worker.init();
  await worker.listenOnce(Events.READY);
  await worker.send(Events.INIT);
  await worker.listenOnce(Events.INIT_COMPLETE);
  return worker;
}