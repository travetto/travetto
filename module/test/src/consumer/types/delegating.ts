import type { SuitesSummary, TestConsumerShape, TestRunState } from '../types.ts';
import type { TestEvent } from '../../model/event.ts';

/**
 * Delegating event consumer
 */
export abstract class DelegatingConsumer implements TestConsumerShape {
  #consumers: TestConsumerShape[];
  #transformer?: (ev: TestEvent) => typeof ev;
  #filter?: (ev: TestEvent) => boolean;

  constructor(consumers: TestConsumerShape[]) {
    this.#consumers = consumers;
    for (const c of consumers) {
      c.onEvent = c.onEvent.bind(c);
    }
  }

  withTransformer(transformer: (ev: TestEvent) => typeof ev): this {
    this.#transformer = transformer;
    return this;
  }

  withFilter(filter: (ev: TestEvent) => boolean): this {
    this.#filter = filter;
    return this;
  }

  async onStart(state: TestRunState): Promise<void> {
    for (const c of this.#consumers) {
      await c.onStart?.(state);
    }
  }

  onEvent(e: TestEvent): void {
    if (this.#transformer) {
      e = this.#transformer(e);
    }
    if (this.#filter?.(e) === false) {
      return;
    }
    for (const c of this.#consumers) {
      c.onEvent(e);
    }

    this.onEventDone?.(e);
  }

  async summarize(summary?: SuitesSummary): Promise<void> {
    if (summary) {
      for (const c of this.#consumers) {
        await c.onSummary?.(summary);
      }
    }
  }

  onEventDone?(e: TestEvent): void;
}