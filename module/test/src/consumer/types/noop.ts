import type { TestEvent } from '../../model/event';
import type { TestConsumerShape } from '../types';
import { TestConsumer } from '../registry';

/**
 * Does nothing consumer
 */
@TestConsumer()
export class NoopConsumer implements TestConsumerShape {
  onEvent(event: TestEvent): void { }
}