import { ShutdownManager, TimeUtil } from '@travetto/base';

import type { RunState } from '../../src/execute/types';

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState): Promise<void> {
  const { RunnerUtil } = await import('../../src/execute/util.js');
  const { Runner } = await import('../../src/execute/runner.js');

  RunnerUtil.registerCleanup('runner');

  await TimeUtil.wait(TimeUtil.getEnvTime('TRV_TEST_DELAY', 0));

  try {
    const res = await new Runner(opts).run();
    return ShutdownManager.exit(res ? 0 : 1);
  } catch (err) {
    console.error('Test Worker Failed', { error: err });
    return ShutdownManager.exit(1);
  }
}