import { EnvInit } from '@travetto/base/bin/init';
import { PrecompileUtil } from '@travetto/compiler/bin/lib';

import type { RunState } from '../../src/execute/types';

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState) {
  EnvInit.init({
    debug: '0',
    set: { TRV_LOG_TIME: '0' },
    append: {
      TRV_RESOURCES: 'test/resources',
      TRV_PROFILES: 'test',
      TRV_SRC_LOCAL: '^test',
      TRV_SRC_COMMON: '^test-support'
    }
  });

  await PrecompileUtil.compile();
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init', '@trv:registry/init');

  const { RunnerUtil } = await import('../../src/execute/util');
  const { Runner } = await import('../../src/execute/runner');

  RunnerUtil.registerCleanup('runner');

  try {
    const res = await new Runner(opts).run();
    process.exit(res ? 0 : 1);
  } catch (err) {
    console.error('Test Worker Failed', { error: err });
    process.exit(1);
  }
}