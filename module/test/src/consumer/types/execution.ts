import { ChildCommChannel } from '@travetto/worker';

import { TestEvent } from '../../model/event';
import { TestConsumer } from '../types';
import { SerializeUtil } from '../serialize';
import { Consumable } from '../registry';

/**
 * Triggers each event as an IPC command to a parent process
 */
@Consumable('exec')
export class ExecutionEmitter extends ChildCommChannel<TestEvent> implements TestConsumer {

  onEvent(event: TestEvent): void {
    this.send(event.type, JSON.parse(SerializeUtil.serializeToJSON(event)));
  }
}