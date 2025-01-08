import type { TestConsumer } from '../types';
import { TestResultsSummarizer } from './summarizer';
import { TestConsumerRegistry } from '../registry';
import type { TestEvent } from '../../model/event';
import { DelegatingConsumer } from './delegating';

/**
 * Test consumer with support for multiple nested consumers, and summarization
 */
export class RunnableTestConsumer extends DelegatingConsumer {
  /**
   * Build a runnable test consumer given a format or a full consumer
   */
  static async get(consumer: string | TestConsumer): Promise<RunnableTestConsumer> {
    return new RunnableTestConsumer([await TestConsumerRegistry.getInstance(consumer)]);
  }

  #results?: TestResultsSummarizer;

  constructor(consumers: TestConsumer[]) {
    super(consumers);
    this.#results = consumers.find(x => !!x.onSummary) ? new TestResultsSummarizer() : undefined;
  }

  onEventDone(e: TestEvent): void {
    this.#results?.onEvent(e);
  }

  async summarizeAsBoolean(): Promise<boolean> {
    await this.summarize(this.#results?.summary);
    return (this.#results?.summary.failed ?? 0) <= 0;
  }
}