import { TestEvent, EventPhase, EventEntity } from '../../model';
import { Consumer } from './types';

import { serialize } from '../../worker/error';
import { LocalWorker } from '../../worker';

export class WorkerEmitter extends LocalWorker<TestEvent> implements Consumer {
  onEvent(event: TestEvent) {
    if (event.phase === 'after') {
      if (event.type === 'test') {
        if (event.test.error) {
          event.test.error = serialize(event.test.error);
        }
      } else if (event.type === 'assertion') {
        if (event.assertion.error) {
          event.assertion.error = serialize(event.assertion.error);
        }
      }
    }

    this.send(event);
  }
}