import { type Class, RuntimeIndex } from '@travetto/runtime';
import { AllViewSymbol } from '@travetto/schema/src/internal/types';
import { SchemaRegistry } from '@travetto/schema';

import { TestConsumerRegistry } from '../../src/consumer/registry';
import type { RunState } from '../../src/execute/types';

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState): Promise<void> {
  const { RunnerUtil } = await import('../../src/execute/util');
  const { Runner } = await import('../../src/execute/runner');

  RunnerUtil.registerCleanup('runner');

  try {
    const res = await new Runner(opts).run();
    process.exitCode = res ? 0 : 1;
  } catch (err) {
    console.error('Test Worker Failed', { error: err });
    process.exitCode = 1;
  }
}

export async function selectConsumer(cls: Class, fieldName: string, consumer?: string) {
  await TestConsumerRegistry.manualInit();

  let types = TestConsumerRegistry.getTypes();

  if (consumer?.includes('/')) {
    await import((RuntimeIndex.getEntry(consumer) ?? RuntimeIndex.getFromImport(consumer))!.outputFile);
    types = TestConsumerRegistry.getTypes();
  }

  SchemaRegistry.get(cls).views[AllViewSymbol].schema[fieldName].enum = {
    message: `{path} is only allowed to be "${types.join('" or "')}"`,
    values: types
  };
}