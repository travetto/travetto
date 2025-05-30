import type { TestConsumerShape } from '../types.ts';
import { TestResultsSummarizer } from './summarizer.ts';
import type { TestEvent } from '../../model/event.ts';
import { DelegatingConsumer } from './delegating.ts';

/**
 * Test consumer with support for multiple nested consumers, and summarization
 */
export class RunnableTestConsumer extends DelegatingConsumer {

  #results?: TestResultsSummarizer;

  constructor(...consumers: TestConsumerShape[]) {
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