import { EnvInit } from '@travetto/base/support/bin/init';
import { Host } from '@travetto/boot';

import { runTests } from './bin/run';

// Direct entry point
export function main(...args: string[]): Promise<void> {
  EnvInit.init({
    debug: '0',
    set: { TRV_LOG_TIME: '0' },
    append: {
      TRV_RESOURCES: `${Host.PATH.test}/${Host.PATH.resources}`,
      TRV_PROFILES: 'test',
      TRV_SRC_LOCAL: `^${Host.PATH.test}`,
      TRV_SRC_COMMON: `^${Host.PATH.testSupport}`
    }
  });

  return runTests({
    args,
    format: process.env.TRV_TEST_FORMAT ?? 'tap',
    mode: 'single',
    concurrency: 1
  });
}