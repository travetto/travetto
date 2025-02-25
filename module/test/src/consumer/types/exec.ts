import { IpcChannel, SerializeUtil } from '@travetto/worker';

import type { TestEvent } from '../../model/event.ts';
import type { TestConsumerShape } from '../types.ts';
import { TestConsumer } from '../registry.ts';

/**
 * Triggers each event as an IPC command to a parent process
 */
@TestConsumer()
export class ExecutionEmitter extends IpcChannel<TestEvent> implements TestConsumerShape {
  onEvent(event: TestEvent): void {
    this.send(event.type, SerializeUtil.beforeSend(event));
  }
}