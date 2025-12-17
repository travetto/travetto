import { getClass, Runtime } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { TestConsumerRegistryIndex } from '../../src/consumer/registry-index.ts';
import type { TestConsumerConfig } from '../../src/execute/types.ts';
import type { TestRunInput } from '../../src/model/test.ts';

/**
 * Run tests given the input state
 * @param state
 */
export async function runTests(state: TestConsumerConfig, input: TestRunInput): Promise<void> {
  const { RunnerUtil } = await import('../../src/execute/util.ts');

  RunnerUtil.registerCleanup('runner');

  try {
    const result = await RunnerUtil.runTests(state, input);
    process.exitCode = result ? 0 : 1;
  } catch (error) {
    console.error('Test Worker Failed', { error });
    process.exitCode = 1;
  }
}

export async function selectConsumer(instance: { format?: string }) {
  if (instance.format?.includes('/')) {
    await Runtime.importFrom(instance.format);
  }

  const types = await TestConsumerRegistryIndex.getTypes();

  SchemaRegistryIndex.getForRegister(getClass(instance), true).registerField('format', {
    enum: {
      message: `{path} is only allowed to be "${types.join('" or "')}"`,
      values: types
    }
  });
}