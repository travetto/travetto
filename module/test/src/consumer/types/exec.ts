import { IpcChannel } from '@travetto/worker';

import type { TestEvent } from '../../model/event';
import type { TestConsumer } from '../types';
import { SerializeUtil } from '../serialize';
import { RegisterConsumer } from '../registry';

/**
 * Triggers each event as an IPC command to a parent process
 */
@RegisterConsumer()
export class ExecutionEmitter extends IpcChannel<TestEvent> implements TestConsumer {
  onEvent(event: TestEvent): void {
    this.send(event.type, JSON.parse(SerializeUtil.serializeToJSON(event)));
  }
}