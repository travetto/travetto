import { Writable } from 'node:stream';

import type { TestEvent } from '../../model/event';
import type { TestEventHandler } from '../types';
import { SerializeUtil } from '../serialize';
import { TestConsumer } from '../registry';

/**
 * Streams all test events a JSON payload, in an nd-json format
 */
@TestConsumer()
export class EventStreamer implements TestEventHandler {
  #stream: Writable;

  constructor(stream: Writable = process.stdout) {
    this.#stream = stream;
  }

  onEvent(event: TestEvent): void {
    this.#stream.write(`${SerializeUtil.serializeToJSON(event)}\n`);
  }
}