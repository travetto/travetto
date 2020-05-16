import { TestEvent } from '../../model/event';
import { TestConsumer } from '../../model/consumer';
import { Consumable } from '../registry';

/**
 * Does nothing consumer
 */
@Consumable('noop', true)
export class NoopConsumer implements TestConsumer {
  onEvent(event: TestEvent): void { }
}