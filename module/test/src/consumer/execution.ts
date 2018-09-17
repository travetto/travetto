import { LocalExecution } from '@travetto/exec';

import { TestEvent } from '../model/event';
import { Consumer } from './types';
import { ConsumerUtil } from './util';

export class ExecutionEmitter extends LocalExecution<TestEvent> implements Consumer {
  onEvent(event: TestEvent) {
    const out = { ...event };
    ConsumerUtil.serializeErrors(out);
    this.send(event.type, out);
  }
}