import path from 'node:path';

import type { RegistryAdapter } from '@travetto/registry';
import { type Class, classConstruct, describeFunction } from '@travetto/runtime';

import type { TestConsumerConfig, TestConsumerShape } from './types.ts';

/**
 * Test Results Handler Registry
 */
export class TestConsumerRegistryAdapter implements RegistryAdapter<TestConsumerConfig> {
  config: TestConsumerConfig;
  #cls: Class<TestConsumerShape>;

  constructor(cls: Class<TestConsumerShape>) {
    this.#cls = cls;
  }

  register(...data: Partial<TestConsumerConfig>[]): TestConsumerConfig {
    const desc = describeFunction(this.#cls);
    this.config ??= {
      cls: this.#cls,
      type: desc.module?.includes('@travetto') ? path.basename(desc.modulePath) : desc.import
    };
    Object.assign(this.config, ...data);
    return this.config;
  }

  finalize(): void {
    // Do nothing for now
  }

  get(): TestConsumerConfig {
    return this.config;
  }

  async instance(options?: Record<string, unknown>): Promise<TestConsumerShape> {
    const inst = classConstruct(this.#cls);
    await inst.setOptions?.(options);
    return inst;
  }
}
