import { TestEvent } from '../model/event';
import { Consumer } from '../model/consumer';
import { ConsumerUtil } from './util';

export class EventStream implements Consumer {

  constructor(private stream: NodeJS.WriteStream = process.stdout) { }

  onEvent(event: TestEvent) {
    const out = { ...event };
    ConsumerUtil.serializeErrors(out);
    this.stream.write(`${JSON.stringify(out)}\n`);
  }
}