import { ExecUtil, LocalExecution } from '@travetto/exec';

import { TestEvent } from '../model/event';
import { Consumer } from './types';

export class ExecutionEmitter extends LocalExecution<TestEvent> implements Consumer {
  onEvent(event: TestEvent) {
    const out = { ...event };
    if (out.phase === 'after') {
      if (out.type === 'test') {
        if (out.test.error) {
          out.test.error = ExecUtil.serializeError(out.test.error);
        }
      } else if (out.type === 'assertion') {
        if (out.assertion.error) {
          out.assertion.error = ExecUtil.serializeError(out.assertion.error);
        }
      }
    }

    this.send(event.type, out);
  }
}