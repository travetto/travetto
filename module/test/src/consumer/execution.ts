import { TestEvent, EventPhase, EventEntity } from '../model';
import { Consumer } from './types';

import { serializeError, LocalExecution } from '@travetto/exec';

export class ExecutionEmitter extends LocalExecution<TestEvent> implements Consumer {
  onEvent(event: TestEvent) {
    const out = { ...event };
    if (out.phase === 'after') {
      if (out.type === 'test') {
        if (out.test.error) {
          out.test.error = serializeError(out.test.error);
        }
      } else if (out.type === 'assertion') {
        if (out.assertion.error) {
          out.assertion.error = serializeError(out.assertion.error);
        }
      }
    }

    this.send(event.type, out);
  }
}