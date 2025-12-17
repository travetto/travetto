import { IpcChannel } from '@travetto/worker';
import { Util } from '@travetto/runtime';

import type { TestEvent, TestRemoveEvent } from '../../model/event.ts';
import type { TestConsumerShape } from '../types.ts';
import { TestConsumer } from '../decorator.ts';

/**
 * Triggers each event as an IPC command to a parent process
 */
@TestConsumer()
export class ExecutionEmitter extends IpcChannel<TestEvent> implements TestConsumerShape {

  sendPayload(payload: unknown & { type: string }): void {
    this.send(payload.type, JSON.parse(Util.serializeToJSON(payload)));
  }

  onEvent(event: TestEvent): void {
    this.sendPayload(event);
  }
  onRemoveEvent(event: TestRemoveEvent): void {
    this.sendPayload(event);
  }
}