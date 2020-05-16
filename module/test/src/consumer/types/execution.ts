import { ChildCommChannel } from '@travetto/worker';

import { TestEvent } from '../../model/event';
import { TestConsumer } from '../../model/consumer';
import { ConsumerUtil } from '../util';
import { Consumable } from '../registry';

/**
 * Triggers each event as an IPC command to a parent process
 */
@Consumable('exec')
export class ExecutionEmitter extends ChildCommChannel<TestEvent> implements TestConsumer {

  onEvent(event: TestEvent) {
    const out = { ...event };
    ConsumerUtil.serializeErrors(out);
    this.send(event.type, out);
  }
}