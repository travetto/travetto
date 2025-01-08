import type { SuitesSummary, TestConsumer, TestRunState } from '../types';
import type { TestEvent } from '../../model/event';

/**
 * Delegating event consumer
 */
export abstract class DelegatingConsumer implements TestConsumer {
  #consumers: TestConsumer[];
  #transformer?: (ev: TestEvent) => typeof ev;
  #filter?: (ev: TestEvent) => boolean;

  constructor(consumers: TestConsumer[]) {
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