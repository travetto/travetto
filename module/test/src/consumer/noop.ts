import { Consumer } from '../model/consumer';
import { TestEvent } from '../model/event';

export class NoopConsumer implements Consumer {
  onEvent(event: TestEvent): void { }
}