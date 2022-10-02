import { envInit } from './bin/env';
import { runTests } from './bin/run';

// Direct entry point
export function main(...args: string[]): Promise<void> {
  envInit();

  return runTests({
    args,
    format: process.env.TRV_TEST_FORMAT ?? 'tap',
    mode: 'single',
    concurrency: 1
  });
}