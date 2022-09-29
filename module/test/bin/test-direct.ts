import { EnvInit } from '@travetto/base/bin/init';
import { runTests } from '../support/bin/run';

// Direct entry point
export function main(...args: string[]): Promise<void> {
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

  return runTests({
    args,
    format: process.env.TRV_TEST_FORMAT ?? 'tap',
    mode: 'single',
    concurrency: 1
  });
}