import type { Class, ConcreteClass } from '@travetto/base';
import { TestConsumer } from './types';

/**
 * Test Results Handler Registry
 */
class $TestConsumerRegistry {
  #registered = new Map<string, Class<TestConsumer>>();
  #primary: Class<TestConsumer>;

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
   * @param isDefault Set as the default consumer
   */
  add(type: string, cls: Class<TestConsumer>, isDefault = false): void {
    if (isDefault) {
      this.#primary = cls;
    }
    this.#registered.set(type, cls);
  }

  /**
   * Retrieve a registered consumer
   * @param type The unique identifier
   */
  get(type: string): Class<TestConsumer> {
    return this.#registered.get(type)!;
  }

  /**
   * Get a consumer instance that supports summarization
   * @param consumer The consumer identifier or the actual consumer
   */
  async getInstance(consumer: string | TestConsumer): Promise<TestConsumer> {
    // TODO: Fix consumer registry init
    await this.manualInit();

    return typeof consumer === 'string' ?
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      new ((this.get(consumer) ?? this.#primary) as ConcreteClass)() :
      consumer;
  }
}

export const TestConsumerRegistry = new $TestConsumerRegistry();

/**
 * Registers a class a valid test consumer
 * @param type The unique identifier for the consumer
 * @param isDefault Is this the default consumer.  Last one wins
 */
export function Consumable(type: string, isDefault = false): (cls: Class<TestConsumer>) => void {
  return function (cls: Class<TestConsumer>): void {
    TestConsumerRegistry.add(type, cls, isDefault);
  };
}