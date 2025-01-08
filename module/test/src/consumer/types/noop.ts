import type { TestEvent } from '../../model/event';
import type { TestConsumer } from '../types';
import { Consumable } from '../registry';

/**
 * Does nothing consumer
 */
@Consumable()
export class NoopConsumer implements TestConsumer {
  onEvent(event: TestEvent): void { }
}