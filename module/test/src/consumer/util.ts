import { CommUtil } from '@travetto/worker';

import { TestEvent, } from '../model/event';

export class ConsumerUtil {
  static serializeErrors(out: TestEvent) {
    if (out.phase === 'after') {
      if (out.type === 'test') {
        if (out.test.error) {
          out.test.error = CommUtil.serializeError(out.test.error);
        }
      } else if (out.type === 'assertion') {
        if (out.assertion.error) {
          out.assertion.error = CommUtil.serializeError(out.assertion.error);
        }
      }
    }
  }
}