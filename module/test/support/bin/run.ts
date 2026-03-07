import type { TestConsumerConfig } from '../../src/execute/types.ts';
import type { TestRunInput } from '../../src/model/test.ts';

/**
 * Run tests given the input state
 * @param state
 */
export async function runTests(state: TestConsumerConfig, input: TestRunInput): Promise<void> {
  const { RunUtil } = await import('../../src/execute/run.ts');

  try {
    const result = await RunUtil.runTests(state, input);
    process.exitCode = result ? 0 : 1;
  } catch (error) {
    console.error('Test Worker Failed', { error });
    process.exitCode = 1;
  }
}

export type TestConsumerType = 'tap' | 'tap-summary' | 'json' | 'exec' | 'event' | 'xunit' | 'custom';