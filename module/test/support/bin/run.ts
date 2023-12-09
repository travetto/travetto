import timers from 'node:timers/promises';

import { Env } from '@travetto/base';

import type { RunState } from '../../src/execute/types';

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState): Promise<void> {
  const { RunnerUtil } = await import('../../src/execute/util.js');
  const { Runner } = await import('../../src/execute/runner.js');

  RunnerUtil.registerCleanup('runner');

  await timers.setTimeout(Env.TRV_TEST_DELAY.time ?? 0);

  try {
    const res = await new Runner(opts).run();
    process.exitCode = res ? 0 : 1;
  } catch (err) {
    console.error('Test Worker Failed', { error: err });
    process.exitCode = 1;
  }
}