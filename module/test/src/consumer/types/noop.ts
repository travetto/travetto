import type { TestEvent } from '../../model/event';
import type { TestEventHandler } from '../types';
import { TestConsumer } from '../registry';

/**
 * Does nothing consumer
 */
@TestConsumer()
export class NoopConsumer implements TestEventHandler {
  onEvent(event: TestEvent): void { }
}