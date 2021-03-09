import { runTests } from './lib/run';

// Direct entry point
export function main(...args: string[]) {
  return runTests({
    args,
    format: process.env.TRV_TEST_FORMAT ?? 'tap',
    mode: 'single',
    concurrency: 1
  });
}