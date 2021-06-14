import type { RunState } from '../../src/execute/types';

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState) {
  const { PhaseManager, Util } = await import('@travetto/base');
  await PhaseManager.run('init', '*', ['@trv:registry/init']); // Delay registry

  const { RunnerUtil } = await import('../../src/execute/util');
  const { Runner } = await import('../../src/execute/runner');

  RunnerUtil.registerCleanup('runner');

  if (process.env.TRV_TEST_DELAY) {
    await Util.wait(process.env.TRV_TEST_DELAY as '2s');
  }

  try {
    const res = await new Runner(opts).run();
    process.exit(res ? 0 : 1);
  } catch (err) {
    console.error('Test Worker Failed', { error: err });
    process.exit(1);
  }
}