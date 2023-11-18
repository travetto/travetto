import { ChildCommChannel } from '@travetto/worker';

import { TestEvent } from '../../model/event';
import { TestConsumer } from '../types';
import { ErrorUtil } from '../error';
import { Consumable } from '../registry';

/**
 * Triggers each event as an IPC command to a parent process
 */
@Consumable('exec')
export class ExecutionEmitter extends ChildCommChannel<TestEvent> implements TestConsumer {

  onEvent(event: TestEvent): void {
    const out = { ...event };
    ErrorUtil.serializeTestErrors(out);
    this.send(event.type, out);
  }
}