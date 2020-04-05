import { ChildCommChannel } from '@travetto/worker';

import { TestEvent } from '../../model/event';
import { Consumer } from '../../model/consumer';
import { ConsumerUtil } from '../util';
import { Consumable } from '../registry';

@Consumable('exec')
export class ExecutionEmitter extends ChildCommChannel<TestEvent> implements Consumer {

  onEvent(event: TestEvent) {
    const out = { ...event };
    ConsumerUtil.serializeErrors(out);
    this.send(event.type, out);
  }
}