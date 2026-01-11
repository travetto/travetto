import type { Class } from '@travetto/runtime';

import type { TestConsumerShape } from './types.ts';
import { TestConsumerRegistryIndex } from './registry-index.ts';

/**
 * Registers a class a valid test consumer
 */
export function TestConsumer(): (cls: Class<TestConsumerShape>) => void {
  return function (cls: Class<TestConsumerShape>): void {
    TestConsumerRegistryIndex.getForRegister(cls).register();
  };
}