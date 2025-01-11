import { IpcChannel } from '@travetto/worker';

import type { TestEvent } from '../../model/event';
import type { TestEventHandler } from '../types';
import { SerializeUtil } from '../serialize';
import { TestConsumer } from '../registry';

/**
 * Triggers each event as an IPC command to a parent process
 */
@TestConsumer()
export class ExecutionEmitter extends IpcChannel<TestEvent> implements TestEventHandler {
  onEvent(event: TestEvent): void {
    this.send(event.type, JSON.parse(SerializeUtil.serializeToJSON(event)));
  }
}