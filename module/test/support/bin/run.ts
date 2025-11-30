import { getClass, Runtime } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { TestConsumerRegistryIndex } from '../../src/consumer/registry-index.ts';
import type { RunState } from '../../src/execute/types.ts';

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState): Promise<void> {
  const { RunnerUtil } = await import('../../src/execute/util.ts');
  const { Runner } = await import('../../src/execute/runner.ts');

  RunnerUtil.registerCleanup('runner');

  try {
    const res = await new Runner(opts).run();
    process.exitCode = res ? 0 : 1;
  } catch (err) {
    console.error('Test Worker Failed', { error: err });
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