import { Class } from '@travetto/runtime';

import { TestConsumerShape } from './types';
import { TestConsumerRegistryIndex } from './registry-index';

/**
 * Registers a class a valid test consumer
 */
export function TestConsumer(): (cls: Class<TestConsumerShape>) => void {
  return function (cls: Class<TestConsumerShape>): void {
    TestConsumerRegistryIndex.getForRegister(cls).register();
  };
}