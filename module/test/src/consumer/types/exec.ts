import { IpcChannel } from '@travetto/worker';
import { Util } from '@travetto/runtime';

import type { TestEvent } from '../../model/event';
import type { TestConsumerShape } from '../types';
import { TestConsumer } from '../registry';

/**
 * Triggers each event as an IPC command to a parent process
 */
@TestConsumer()
export class ExecutionEmitter extends IpcChannel<TestEvent> implements TestConsumerShape {
  onEvent(event: TestEvent): void {
    this.send(event.type, JSON.parse(Util.serializeToJSON(event)));
  }
}