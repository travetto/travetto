import { TestEvent } from '../../model/event';
import { TestConsumer } from '../types';
import { Consumable } from '../registry';

/**
 * Does nothing consumer
 */
@Consumable('noop', true)
export class NoopConsumer implements TestConsumer {
  onEvent(event: TestEvent): void { }
}