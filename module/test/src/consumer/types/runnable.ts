import { TestConsumer, TestRunState } from '../types';
import { TestResultsSummarizer } from './summarizer';
import { TestConsumerRegistry } from '../registry';
import { TestEvent } from '../../model/event';

/**
 * Test consumer with support for multiple nested consumers, and summarization
 */
export class RunnableTestConsumer implements TestConsumer {
  /**
   * Build a runnable test consumer given a format or a full consumer
   */
  static async get(consumer: string | TestConsumer): Promise<RunnableTestConsumer> {
    return new RunnableTestConsumer(await TestConsumerRegistry.getInstance(consumer));
  }

  #consumers: TestConsumer[];
  #results: TestResultsSummarizer | undefined;

  constructor(...consumers: TestConsumer[]) {
    this.#consumers = consumers;
    for (const c of consumers) {
      if (!this.#results && c.onSummary) { // If expecting summary
        this.#results = new TestResultsSummarizer();
      }
      c.onEvent = c.onEvent.bind(c);
    }
  }

  async onStart(state: TestRunState): Promise<void> {
    for (const c of this.#consumers) {
      await c.onStart?.(state);
    }
  }

  onEvent(e: TestEvent): void {
    if (this.#results) {
      this.#results.onEvent(e);
    }
    for (const c of this.#consumers) {
      c.onEvent(e);
    }
  }

  async summarize(): Promise<TestResultsSummarizer | undefined> {
    if (this.#results) {
      for (const c of this.#consumers) {
        await c.onSummary?.(this.#results.summary);
      }
      return this.#results;
    }
  }

  async summarizeAsBoolean(): Promise<boolean> {
    const result = await this.summarize();
    if (result) {
      return result.summary.failed <= 0;
    } else {
      return true;
    }
  }
}