import { CliUtil } from '@travetto/cli/src/util';
import type { RunState } from '../../src/execute/types';
import { DEF_ENV, ENV_EXT, load } from './env';

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState) {
  CliUtil.initEnv({ ...DEF_ENV, envExtra: ENV_EXT, watch: false });
  await load();
  const { StandardWorker } = await import('../../src/worker/standard');
  return StandardWorker.run(opts);
}

// Direct entry point
export async function entry(...args: string[]) {
  return runTests({
    args,
    format: process.env.TRV_TEST_FORMAT ?? 'tap',
    mode: 'single',
    concurrency: 1
  });
}