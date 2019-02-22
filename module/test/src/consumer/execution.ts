import { WorkerClient } from '@travetto/worker';

import { TestEvent } from '../model/event';
import { Consumer } from '../model/consumer';
import { ConsumerUtil } from './util';

export class ExecutionEmitter extends WorkerClient<TestEvent> implements Consumer {
  onEvent(event: TestEvent) {
    const out = { ...event };
    ConsumerUtil.serializeErrors(out);
    this.send(event.type, out);
  }
}