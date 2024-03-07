import type { RunState } from '../../src/execute/types';

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState): Promise<void> {
  const { RunnerUtil } = await import('../../src/execute/util');
  const { Runner } = await import('../../src/execute/runner');

  RunnerUtil.registerCleanup('runner');

  try {
    const res = await new Runner(opts).run();
    process.exitCode = res ? 0 : 1;
  } catch (err) {
    console.error('Test Worker Failed', { error: err });
    process.exitCode = 1;
  }
}