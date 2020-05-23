import { TestConsumer } from '../types';
import { TestResultsSummarizer } from './summarizer';
import { TestConsumerRegistry } from '../registry';

/**
 * Test consumer with support for multiple nested consumers, and summarization
 */
export class RunnableTestConsumer implements TestConsumer {
  /**
   * Build a runnable test consumer given a format or a full consumer
   */
  static get(consumer: string | TestConsumer) {
    return new RunnableTestConsumer(TestConsumerRegistry.getInstance(consumer));
  }

  private consumers: TestConsumer[];
  private results: TestResultsSummarizer | undefined;

  constructor(...consumers: TestConsumer[]) {
    this.consumers = consumers;
    for (const c of consumers) {
      if (!this.results && c.onSummary) { // If expecting summary
        this.results = new TestResultsSummarizer();
      }
      c.onEvent = c.onEvent.bind(c);
    }
  }

  onStart() {
    for (const c of this.consumers) {
      if (c.onStart) {
        c.onStart();
      }
    }
  }

  onEvent(e: any) {
    if (this.results) {
      this.results.onEvent(e);
    }
    for (const c of this.consumers) {
      c.onEvent(e);
    }
  }

  summarize() {
    if (this.results) {
      for (const c of this.consumers) {
        if (c.onSummary) {
          c.onSummary(this.results.summary);
        }
      }
      return this.results;
    }
  }
}