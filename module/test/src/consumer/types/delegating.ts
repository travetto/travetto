import type { SuitesSummary, TestConsumerShape, TestRunState } from '../types.ts';
import type { TestEvent, TestRemoveEvent } from '../../model/event.ts';

/**
 * Delegating event consumer
 */
export abstract class DelegatingConsumer implements TestConsumerShape {
  #consumers: TestConsumerShape[];
  #transformer?: (event: TestEvent) => typeof event;
  #filter?: (event: TestEvent) => boolean;

  constructor(consumers: TestConsumerShape[]) {
    this.#consumers = consumers;
    for (const consumer of consumers) {
      consumer.onEvent = consumer.onEvent.bind(consumer);
    }
  }

  withTransformer(transformer: (event: TestEvent) => typeof event): this {
    this.#transformer = transformer;
    return this;
  }

  withFilter(filter: (event: TestEvent) => boolean): this {
    this.#filter = filter;
    return this;
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

  onEvent(event: TestEvent): void {
    if (this.#transformer) {
      event = this.#transformer(event);
    }
    if (this.#filter?.(event) === false) {
      return;
    }
    for (const consumer of this.#consumers) {
      consumer.onEvent(event);
    }

    this.onEventDone?.(event);
  }

  async summarize(summary?: SuitesSummary): Promise<void> {
    if (summary) {
      for (const consumer of this.#consumers) {
        await consumer.onSummary?.(summary);
      }
    }
  }

  onEventDone?(event: TestEvent): void;
}