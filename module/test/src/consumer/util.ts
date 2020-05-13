import { ErrorUtil } from '@travetto/base/src/internal/error';
import { TestEvent, } from '../model/event';

export class ConsumerUtil {
  static serializeErrors(out: TestEvent) {
    if (out.phase === 'after') {
      if (out.type === 'test') {
        if (out.test.error) {
          out.test.error = ErrorUtil.serializeError(out.test.error) as Error;
        }
      } else if (out.type === 'assertion') {
        if (out.assertion.error) {
          out.assertion.error = ErrorUtil.serializeError(out.assertion.error) as Error;
        }
      }
    }
  }
}