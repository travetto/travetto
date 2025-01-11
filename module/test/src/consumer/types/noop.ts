import type { TestEvent } from '../../model/event';
import type { TestConsumer } from '../types';
import { RegisterTestConsumer } from '../registry';

/**
 * Does nothing consumer
 */
@RegisterTestConsumer()
export class NoopConsumer implements TestConsumer {
  onEvent(event: TestEvent): void { }
}