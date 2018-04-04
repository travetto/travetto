import { TestEvent, EventPhase, EventEntity } from '../model';
import { Consumer } from './types';

import { serializeError, LocalExecution } from '@travetto/exec';

export class ExecutionEmitter extends LocalExecution<TestEvent> implements Consumer {
  onEvent(event: TestEvent) {
    if (event.phase === 'after') {
      if (event.type === 'test') {
        if (event.test.error) {
          event.test.error = serializeError(event.test.error);
        }
      } else if (event.type === 'assertion') {
        if (event.assertion.error) {
          event.assertion.error = serializeError(event.assertion.error);
        }
      }
    }

    this.send(event.type, event);
  }
}