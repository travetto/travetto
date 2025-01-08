import type { TestEvent } from '../../model/event';
import type { TestConsumer } from '../types';
import { RegisterConsumer } from '../registry';

/**
 * Does nothing consumer
 */
@RegisterConsumer()
export class NoopConsumer implements TestConsumer {
  onEvent(event: TestEvent): void { }
}