import { Writable } from 'stream';

import { TestEvent } from '../../model/event';
import { TestConsumer } from '../types';
import { ConsumerUtil } from '../util';
import { Consumable } from '../registry';

/**
 * Streams all test events a JSON payload, in an ndjson format
 */
@Consumable('event')
export class EventStreamer implements TestConsumer {
  #stream: Writable;

  constructor(stream: Writable = process.stdout) {
    this.#stream = stream;
  }

  onEvent(event: TestEvent) {
    const out = { ...event };
    ConsumerUtil.serializeErrors(out);
    this.#stream.write(`${JSON.stringify(out)}\n`);
  }
}