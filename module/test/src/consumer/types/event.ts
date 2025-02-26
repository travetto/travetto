import { Writable } from 'node:stream';

import { Util } from '@travetto/runtime';

import type { TestEvent } from '../../model/event';
import type { TestConsumerShape } from '../types';
import { TestConsumer } from '../registry';

/**
 * Streams all test events a JSON payload, in an nd-json format
 */
@TestConsumer()
export class EventStreamer implements TestConsumerShape {
  #stream: Writable;

  constructor(stream: Writable = process.stdout) {
    this.#stream = stream;
  }

  onEvent(event: TestEvent): void {
    this.#stream.write(`${Util.serializeToJSON(event)}\n`);
  }
}