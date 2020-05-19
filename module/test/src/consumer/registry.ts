import { Class } from '@travetto/registry';
import { TestConsumer } from './types';

/**
 * Test Results Handler Registry
 */
export class TestConsumerRegistry {
  private static registered = new Map<string, Class<TestConsumer>>();
  private static primary: Class<TestConsumer>;

  /**
   * Add a new consumer
   * @param type The consumer unique identifier
   * @param cls The consuemr class
   * @param isDefault Set as the default consumer
   */
  static add(type: string, cls: Class<TestConsumer>, isDefault = false) {
    if (isDefault) {
      this.primary = cls;
    }
    this.registered.set(type, cls);
  }

  /**
   * Retreive a registered consumer
   * @param type The unique identifier
   */
  static get(type: string) {
    return this.registered.get(type);
  }

  /**
   * Get a consumer instance that supports summarization
   * @param consumer The consumer identifier or the actual consumer
   */
  static getInstance(consumer: string | TestConsumer): TestConsumer {
    return typeof consumer === 'string' ?
      new (this.get(consumer) || this.primary)() :
      consumer;
  }
}

/**
 * Registers a class a valid test consumer
 * @param type The unique identifier for the consumer
 * @param isDefault Is this the default consumer.  Last one wins
 */
export function Consumable(type: string, isDefault = false) {
  return function (cls: Class<TestConsumer>) {
    TestConsumerRegistry.add(type, cls, isDefault);
  };
}