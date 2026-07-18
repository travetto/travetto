import type { Class } from '@travetto/runtime';

import { TestConsumerRegistryIndex } from './registry-index.ts';
import type { TestConsumerShape } from './types.ts';

/**
 * Registers a class a valid test consumer
 */
export function TestConsumer(): (cls: Class<TestConsumerShape>) => void {
  return function (cls: Class<TestConsumerShape>): void {
    TestConsumerRegistryIndex.getForRegister(cls).register();
  };
}
