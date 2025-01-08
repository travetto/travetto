import { Writable } from 'node:stream';

import { TestEvent } from '../../model/event';
import { TestConsumer } from '../types';
import { SerializeUtil } from '../serialize';
import { RegisterConsumer } from '../registry';

/**
 * Streams all test events a JSON payload, in an nd-json format
 */
@RegisterConsumer()
export class EventStreamer implements TestConsumer {
  #stream: Writable;

  constructor(stream: Writable = process.stdout) {
    this.#stream = stream;
  }

  onEvent(event: TestEvent): void {
    this.#stream.write(`${SerializeUtil.serializeToJSON(event)}\n`);
  }
}