import path from 'path';
import { classConstruct, describeFunction, RuntimeIndex, type Class } from '@travetto/runtime';
import { TestConsumer } from './types';
import { RunState } from '../execute/types';

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
   * Import a specific path and load all consumers there
   */
  async importConsumers(pth: string): Promise<void> {
    await import((RuntimeIndex.getEntry(pth) ?? RuntimeIndex.getFromImport(pth))!.outputFile);
  }

  /**
   * Add a new consumer
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
  async getInstance(state: Pick<RunState, 'consumer' | 'consumerOptions'>): Promise<TestConsumer> {
    // TODO: Fix consumer registry init
    await this.manualInit();
    const inst = classConstruct(this.get(state.consumer));
    await inst.setOptions?.(state.consumerOptions ?? {});
    return inst;
  }
}

export const TestConsumerRegistry = new $TestConsumerRegistry();

/**
 * Registers a class a valid test consumer
 */
export function RegisterConsumer(): (cls: Class<TestConsumer>) => void {
  return function (cls: Class<TestConsumer>): void {
    TestConsumerRegistry.add(cls);
  };
}