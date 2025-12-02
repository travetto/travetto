import type { SuitesSummary, TestConsumerShape, TestRunState } from '../types.ts';
import type { TestEvent } from '../../model/event.ts';

/**
 * Delegating event consumer
 */
export abstract class DelegatingConsumer implements TestConsumerShape {
  #consumers: TestConsumerShape[];
  #transformer?: (event: TestEvent) => typeof event;
  #filter?: (event: TestEvent) => boolean;

  constructor(consumers: TestConsumerShape[]) {
    this.#consumers = consumers;
    for (const c of consumers) {
      c.onEvent = c.onEvent.bind(c);
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
    for (const c of this.#consumers) {
      await c.onStart?.(state);
    }
  }

  onEvent(event: TestEvent): void {
    if (this.#transformer) {
      event = this.#transformer(event);
    }
    if (this.#filter?.(event) === false) {
      return;
    }
    for (const c of this.#consumers) {
      c.onEvent(event);
    }

    this.onEventDone?.(event);
  }

  async summarize(summary?: SuitesSummary): Promise<void> {
    if (summary) {
      for (const c of this.#consumers) {
        await c.onSummary?.(summary);
      }
    }
  }

  onEventDone?(event: TestEvent): void;
}