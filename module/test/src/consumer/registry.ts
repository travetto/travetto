import { ScanFs } from '@travetto/boot/src';
import { Class } from '@travetto/registry';
import { TestConsumer } from './types';

/**
 * Test Results Handler Registry
 */
class $TestConsumerRegistry {
  private registered = new Map<string, Class<TestConsumer>>();
  private primary: Class<TestConsumer>;

  /**
   * Manual initialization when running oustide of the bootstrap process
   */
  async manualInit() {
    for (const entry of await ScanFs.scanDir({ testDir: f => true, testFile: f => f.includes('types/') }, __dirname)) {
      if (entry.stats.isFile()) {
        require(entry.file);
      }
    }
  }

  /**
   * Add a new consumer
   * @param type The consumer unique identifier
   * @param cls The consumer class
   * @param isDefault Set as the default consumer
   */
  add(type: string, cls: Class<TestConsumer>, isDefault = false) {
    if (isDefault) {
      this.primary = cls;
    }
    this.registered.set(type, cls);
  }

  /**
   * Retrieve a registered consumer
   * @param type The unique identifier
   */
  get(type: string) {
    return this.registered.get(type);
  }

  /**
   * Get a consumer instance that supports summarization
   * @param consumer The consumer identifier or the actual consumer
   */
  getInstance(consumer: string | TestConsumer): TestConsumer {
    return typeof consumer === 'string' ?
      new (this.get(consumer) || this.primary)() :
      consumer;
  }
}

export const TestConsumerRegistry = new $TestConsumerRegistry();

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