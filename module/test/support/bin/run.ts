import { PhaseManager } from '@travetto/boot';
import { TimeUtil } from '@travetto/base';

import type { RunState } from '../../src/execute/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      TRV_TEST_DELAY?: '2s';
    }
  }
}

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState): Promise<void> {
  await PhaseManager.run('init', '*', ['@trv:registry/init']); // Delay registry

  const { RunnerUtil } = await import('../../src/execute/util');
  const { Runner } = await import('../../src/execute/runner');

  RunnerUtil.registerCleanup('runner');

  if (process.env.TRV_TEST_DELAY) {
    await TimeUtil.wait(process.env.TRV_TEST_DELAY);
  }

  try {
    const res = await new Runner(opts).run();
    process.exit(res ? 0 : 1);
  } catch (err) {
    console.error('Test Worker Failed', { error: err });
    process.exit(1);
  }
}