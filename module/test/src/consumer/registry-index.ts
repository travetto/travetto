import { RuntimeIndex, type Class } from '@travetto/runtime';
import { Registry, type RegistryIndex, RegistryIndexStore } from '@travetto/registry';

import type { TestConsumerShape } from './types.ts';
import type { TestConsumerConfig } from '../execute/types.ts';
import { TestConsumerRegistryAdapter } from './registry-adapter.ts';

/**
 * Test Results Handler Registry
 */
export class TestConsumerRegistryIndex implements RegistryIndex {

  static #instance = Registry.registerIndex(this);

  static getForRegister(cls: Class): TestConsumerRegistryAdapter {
    return this.#instance.store.getForRegister(cls);
  }

  /**
   * Get all registered types
   */
  static getTypes(): Promise<string[]> {
    return this.#instance.getTypes();
  }

  /**
   * Get a consumer instance that supports summarization
   * @param consumerConfig The consumer configuration
   */
  static getInstance(consumerConfig: TestConsumerConfig): Promise<TestConsumerShape> {
    return this.#instance.getInstance(consumerConfig);
  }

  #initialized: Promise<void>;
  store = new RegistryIndexStore(TestConsumerRegistryAdapter);

  /** @private */ constructor(source: unknown) { Registry.validateConstructor(source); }

  /**
   * Manual initialization when running outside of the bootstrap process
   */
  async #init(): Promise<void> {
    const allFiles = RuntimeIndex.find({
      module: module => module.name === '@travetto/test',
      file: file => file.relativeFile.startsWith('src/consumer/types/')
    });
    for (const file of allFiles) {
      await import(file.outputFile);
    }
    for (const cls of this.store.getClasses()) {
      this.store.finalize(cls);
    }
  }

  /**
   * Get types
   */
  async getTypes(): Promise<string[]> {
    await (this.#initialized ??= this.#init());
    const out: string[] = [];
    for (const cls of this.store.getClasses()) {
      const adapter = this.store.get(cls);
      out.push(adapter.get().type);
    }
    return out;
  }

  /**
   * Get a consumer instance that supports summarization
   * @param consumer The consumer identifier or the actual consumer
   */
  async getInstance(state: Pick<TestConsumerConfig, 'consumer' | 'consumerOptions'>): Promise<TestConsumerShape> {
    await (this.#initialized ??= this.#init());
    for (const cls of this.store.getClasses()) {
      const adapter = this.store.get(cls);
      if (adapter.get().type === state.consumer) {
        return adapter.instance(state.consumerOptions);
      }
    }
    throw new Error(`No test consumer registered for type ${state.consumer}`);
  }
}