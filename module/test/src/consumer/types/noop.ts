import type { TestEvent } from '../../model/event.ts';
import type { TestConsumerShape } from '../types.ts';
import { TestConsumer } from '../registry.ts';

/**
 * Does nothing consumer
 */
@TestConsumer()
export class NoopConsumer implements TestConsumerShape {
  onEvent(event: TestEvent): void { }
}