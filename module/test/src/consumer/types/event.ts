import type { Writable } from 'node:stream';

import { JSONUtil } from '@travetto/runtime';

import type { TestEvent, TestRemoveEvent } from '../../model/event.ts';
import type { TestConsumerShape } from '../types.ts';
import { TestConsumer } from '../decorator.ts';

/**
 * Streams all test events a JSON payload, in an nd-json format
 */
@TestConsumer()
export class EventStreamer implements TestConsumerShape {
  #stream: Writable;

  constructor(stream: Writable = process.stdout) {
    this.#stream = stream;
  }

  sendPayload(payload: unknown): void {
    this.#stream.write(`${JSONUtil.toUTF8(JSONUtil.cloneForTransmit(payload))}\n`);
  }

  onEvent(event: TestEvent): void {
    this.sendPayload(event);
  }

  onRemoveEvent(event: TestRemoveEvent): void {
    this.sendPayload(event);
  }
}