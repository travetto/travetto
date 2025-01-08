import { IpcChannel } from '@travetto/worker';

import type { TestEvent } from '../../model/event';
import type { TestConsumer } from '../types';
import { SerializeUtil } from '../serialize';
import { Consumable } from '../registry';

/**
 * Triggers each event as an IPC command to a parent process
 */
@Consumable()
export class ExecutionEmitter extends IpcChannel<TestEvent> implements TestConsumer {
  onEvent(event: TestEvent): void {
    this.send(event.type, JSON.parse(SerializeUtil.serializeToJSON(event)));
  }
}