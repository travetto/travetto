import { ConsoleManager, defineGlobalEnv } from '@travetto/base';
import { runTests } from './bin/run';

// Direct entry point
export function main(...args: string[]): Promise<void> {
  defineGlobalEnv({ test: true });
  ConsoleManager.setDebugFromEnv();

  return runTests({
    args,
    format: process.env.TRV_TEST_FORMAT ?? 'tap',
    mode: 'single',
    concurrency: 1
  });
}