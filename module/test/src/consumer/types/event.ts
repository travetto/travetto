import { TestEvent } from '../../model/event';
import { Consumer } from '../../model/consumer';
import { ConsumerUtil } from '../util';
import { Consumable } from '../registry';

@Consumable('event')
export class EventStreamer implements Consumer {

  constructor(private stream: NodeJS.WriteStream = process.stdout) { }

  onEvent(event: TestEvent) {
    const out = { ...event };
    ConsumerUtil.serializeErrors(out);
    this.stream.write(`${JSON.stringify(out)}\n`);
  }
}