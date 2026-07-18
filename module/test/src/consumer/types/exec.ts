import { JSONUtil } from '@travetto/runtime';
import { IpcChannel } from '@travetto/worker';

import type { TestEvent, TestRemoveEvent } from '../../model/event.ts';
import { TestConsumer } from '../decorator.ts';
import type { TestConsumerShape } from '../types.ts';

/**
 * Triggers each event as an IPC command to a parent process
 */
@TestConsumer()
export class ExecutionEmitter extends IpcChannel<TestEvent> implements TestConsumerShape {
  sendPayload(payload: unknown & { type: string }): void {
    this.send(payload.type, JSONUtil.cloneForTransmit(payload));
  }

  onEvent(event: TestEvent): void {
    this.sendPayload(event);
  }

  onRemoveEvent(event: TestRemoveEvent): void {
    this.sendPayload(event);
  }
}
