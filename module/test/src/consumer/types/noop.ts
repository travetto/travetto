import { TestEvent } from '../../model/event';
import { Consumer } from '../../model/consumer';
import { Consumable } from '../registry';

@Consumable('noop', true)
export class NoopConsumer implements Consumer {
  onEvent(event: TestEvent): void { }
}