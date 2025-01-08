import path from 'path';
import { classConstruct, describeFunction, type Class } from '@travetto/runtime';
import { TestConsumer } from './types';

/**
 * Test Results Handler Registry
 */
class $TestConsumerRegistry {
  #registered = new Map<string, Class<TestConsumer>>();

  /**
   * Manual initialization when running outside of the bootstrap process
   */
  async manualInit(): Promise<void> {
    await import('./types/all');
  }

  /**
   * Add a new consumer
   * @param type The consumer unique identifier
   * @param cls The consumer class
   */
  add(cls: Class<TestConsumer>): void {
    const desc = describeFunction(cls);
    const key = desc.module?.includes('@travetto') ? path.basename(desc.modulePath) : desc.import;
    this.#registered.set(key, cls);
  }

  /**
   * Retrieve a registered consumer
   * @param type The unique identifier
   */
  get(type: string): Class<TestConsumer> {
    return this.#registered.get(type)!;
  }

  /**
   * Get types
   */
  getTypes(): string[] {
    return [...this.#registered.keys()];
  }

  /**
   * Get a consumer instance that supports summarization
   * @param consumer The consumer identifier or the actual consumer
   */
  async getInstance(consumer: string | TestConsumer): Promise<TestConsumer> {
    // TODO: Fix consumer registry init
    await this.manualInit();

    return typeof consumer === 'string' ?
      classConstruct(this.get(consumer)) :
      consumer;
  }
}

export const TestConsumerRegistry = new $TestConsumerRegistry();

/**
 * Registers a class a valid test consumer
 * @param type The unique identifier for the consumer
 */
export function Consumable(): (cls: Class<TestConsumer>) => void {
  return function (cls: Class<TestConsumer>): void {
    TestConsumerRegistry.add(cls);
  };
}