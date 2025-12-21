import type { SuitesSummary, TestConsumerShape, TestRunState } from '../types.ts';
import type { TestEvent, TestRemoveEvent } from '../../model/event.ts';

/**
 * Delegating event consumer
 */
export abstract class DelegatingConsumer implements TestConsumerShape {
  #consumers: TestConsumerShape[];

  constructor(consumers: TestConsumerShape[]) {
    this.#consumers = consumers;
    for (const consumer of consumers) {
      consumer.onEvent = consumer.onEvent.bind(consumer);
    }
  }

  async onStart(state: TestRunState): Promise<void> {
    for (const consumer of this.#consumers) {
      await consumer.onStart?.(state);
    }
  }

  onRemoveEvent(event: TestRemoveEvent): void {
    for (const consumer of this.#consumers) {
      consumer.onRemoveEvent?.(event);
    }
  }

  delegateEvent(event: TestEvent): void {
    for (const consumer of this.#consumers) {
      consumer.onEvent(event);
    }
  }

  onEvent(event: TestEvent): void {
    let result = event;
    if (this.transform) {
      result = this.transform(event) ?? event;
    }
    if (result) {
      this.delegateEvent(result);
    }
  }

  async summarize(summary?: SuitesSummary): Promise<void> {
    if (summary) {
      for (const consumer of this.#consumers) {
        await consumer.onSummary?.(summary);
      }
    }
  }

  transform?(event: TestEvent): TestEvent | undefined;
}