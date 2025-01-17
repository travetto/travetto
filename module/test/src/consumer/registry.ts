import path from 'path';
import { classConstruct, describeFunction, type Class } from '@travetto/runtime';
import type { TestConsumerShape } from './types';
import type { RunState } from '../execute/types';

/**
 * Test Results Handler Registry
 */
class $TestConsumerRegistry {
  #registered = new Map<string, Class<TestConsumerShape>>();

  /**
   * Manual initialization when running outside of the bootstrap process
   */
  async manualInit(): Promise<void> {
    await import('./types/all');
  }

  /**
   * Add a new consumer
   * @param cls The consumer class
   */
  add(cls: Class<TestConsumerShape>): void {
    const desc = describeFunction(cls);
    const key = desc.module?.includes('@travetto') ? path.basename(desc.modulePath) : desc.import;
    this.#registered.set(key, cls);
  }

  /**
   * Retrieve a registered consumer
   * @param type The unique identifier
   */
  get(type: string): Class<TestConsumerShape> {
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
  async getInstance(state: Pick<RunState, 'consumer' | 'consumerOptions'>): Promise<TestConsumerShape> {
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
export function TestConsumer(): (cls: Class<TestConsumerShape>) => void {
  return function (cls: Class<TestConsumerShape>): void {
    TestConsumerRegistry.add(cls);
  };
}