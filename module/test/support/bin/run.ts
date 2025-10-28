import { castTo, Runtime } from '@travetto/runtime';
import { RegistryV2 } from '@travetto/registry';
import { SchemaRegistryIndex } from '@travetto/schema';

import { TestConsumerRegistry } from '../../src/consumer/registry.ts';
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

export async function selectConsumer(inst: { format?: string }) {
  await TestConsumerRegistry.manualInit();

  let types = TestConsumerRegistry.getTypes();

  if (inst.format?.includes('/')) {
    await Runtime.importFrom(inst.format);
    types = TestConsumerRegistry.getTypes();
  }

  const cls = inst.constructor;

  RegistryV2.getForRegister(SchemaRegistryIndex, castTo(cls)).get().fields.format.enum = {
    message: `{path} is only allowed to be "${types.join('" or "')}"`,
    values: types
  };
}