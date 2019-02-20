import { WorkerUtil } from '@travetto/worker';

import { TestEvent, } from '../model/event';

export class ConsumerUtil {
  static serializeErrors(out: TestEvent) {
    if (out.phase === 'after') {
      if (out.type === 'test') {
        if (out.test.error) {
          out.test.error = WorkerUtil.serializeError(out.test.error);
        }
      } else if (out.type === 'assertion') {
        if (out.assertion.error) {
          out.assertion.error = WorkerUtil.serializeError(out.assertion.error);
        }
      }
    }
  }
}